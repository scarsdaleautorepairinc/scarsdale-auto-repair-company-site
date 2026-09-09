from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

SHOP_TIMEZONE = ZoneInfo('America/New_York')


def income_report(conn, period, selected):
    start = selected if period == 'day' else selected.replace(day=1)
    days = 1 if period == 'day' else monthrange(start.year, start.month)[1]
    end = start + timedelta(days=days)

    def utc_boundary(day):
        return datetime.combine(day, time.min, SHOP_TIMEZONE).astimezone(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

    boundaries = (utc_boundary(start), utc_boundary(end))
    visits = [dict(row) for row in conn.execute('''
        SELECT ro.id, ro.created_at, c.name customer_name, v.plate
        FROM repair_orders ro JOIN customers c ON c.id=ro.customer_id
        JOIN vehicles v ON v.id=ro.vehicle_id
        WHERE ro.created_at >= ? AND ro.created_at < ? ORDER BY ro.created_at, ro.id
    ''', boundaries)]
    payments = [dict(row) for row in conn.execute('''
        SELECT ro.id, ro.paid_at, ro.paid_amount_cents, c.name customer_name, v.plate
        FROM repair_orders ro JOIN customers c ON c.id=ro.customer_id
        JOIN vehicles v ON v.id=ro.vehicle_id
        WHERE ro.paid_at >= ? AND ro.paid_at < ?
          AND NOT EXISTS (SELECT 1 FROM shop_payments p WHERE p.order_id=ro.id)
        UNION ALL
        SELECT ro.id, p.created_at paid_at, p.amount_cents paid_amount_cents, c.name customer_name, v.plate
        FROM shop_payments p JOIN repair_orders ro ON ro.id=p.order_id
        JOIN customers c ON c.id=ro.customer_id JOIN vehicles v ON v.id=ro.vehicle_id
        WHERE p.created_at >= ? AND p.created_at < ? ORDER BY 2,1
    ''', (*boundaries, *boundaries))]
    buckets = {(start + timedelta(days=i)).isoformat(): dict(visits=0, paid_tickets=0, income_cents=0, missing_amounts=0) for i in range(days)}
    for visit in visits:
        visit['date'] = datetime.fromisoformat(visit['created_at']).astimezone(SHOP_TIMEZONE).date().isoformat()
        buckets[visit['date']]['visits'] += 1
    seen = set()
    for payment in payments:
        payment['date'] = datetime.fromisoformat(payment['paid_at']).astimezone(SHOP_TIMEZONE).date().isoformat()
        bucket = buckets[payment['date']]
        key = (payment['date'], payment['id'])
        if key not in seen:
            bucket['paid_tickets'] += 1
            seen.add(key)
        if payment['paid_amount_cents'] is None:
            bucket['missing_amounts'] += 1
        else:
            bucket['income_cents'] += payment['paid_amount_cents']
    return {
        'period': period, 'start': start.isoformat(), 'end': (end - timedelta(days=1)).isoformat(),
        'timezone': SHOP_TIMEZONE.key,
        'totals': {**{key: sum(bucket[key] for bucket in buckets.values()) for key in ('visits', 'paid_tickets', 'income_cents', 'missing_amounts')}, 'paid_tickets': len({p['id'] for p in payments})},
        'days': [{'date': day, **bucket} for day, bucket in buckets.items()],
        'payments': payments, 'visits': visits,
    }
