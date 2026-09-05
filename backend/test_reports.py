import unittest
from unittest.mock import patch
from backend import test_workflow
from backend.app import main


class IncomeReportsTest(unittest.TestCase):
    def setUp(self):
        test_workflow.WorkflowTest.setUp(self)

    def ticket(self, created):
        with patch.object(main, 'now_iso', return_value=created):
            response = self.client.post('/api/intake', json={'customer_name': 'Report Test', 'phone': 'test', 'concern': 'Test service', 'authorization_name': 'Test'})
        self.assertEqual(response.status_code, 200)
        return response.json()['id']

    def pay(self, ticket, paid_at, amount):
        with patch.object(main, 'now_iso', return_value=paid_at):
            response = self.client.post(f'/api/orders/{ticket}/paid', json={'amount': amount})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def report(self, on, period='day'):
        response = self.client.get('/api/reports/income', params={'on': on, 'period': period})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_arrivals_and_income_use_their_own_dates_and_exact_cents(self):
        older = self.ticket('2026-08-31T14:00:00Z')
        unpaid = self.ticket('2026-09-01T14:00:00Z')
        late = self.ticket('2026-09-02T03:59:59Z')
        self.pay(older, '2026-09-01T15:00:00Z', '100.10')
        self.pay(late, '2026-09-02T03:59:59Z', '20.20')
        self.pay(unpaid, '2026-09-02T04:00:00Z', '50.00')
        report = self.report('2026-09-01')
        self.assertEqual(report['totals'], {'visits': 2, 'paid_tickets': 2, 'income_cents': 12030, 'missing_amounts': 0})
        self.assertEqual(self.report('2026-09-02')['totals']['income_cents'], 5000)
        month = self.report('2026-09-01', 'month')
        self.assertEqual(len(month['days']), 30)
        self.assertEqual(month['totals']['income_cents'], 17030)
        self.assertEqual(sum(day['income_cents'] for day in month['days']), 17030)

    def test_repeat_paid_and_later_estimate_edits_do_not_change_income(self):
        ticket = self.ticket('2026-09-01T14:00:00Z')
        original = self.pay(ticket, '2026-09-01T15:00:00Z', '125.99')
        self.client.post(f'/api/orders/{ticket}/estimate-items', json={'description': 'Later draft', 'qty': 1, 'unit_price': 999})
        repeated = self.pay(ticket, '2026-09-02T15:00:00Z', '125.99')
        self.assertEqual(repeated['paid_at'], original['paid_at'])
        self.assertEqual(repeated['paid_amount_cents'], 12599)
        self.assertEqual(self.report('2026-09-01')['totals']['income_cents'], 12599)
        self.assertEqual(self.report('2026-09-02')['totals']['income_cents'], 0)

    def test_unpaid_and_legacy_unknown_amounts_are_not_assumed_income(self):
        unpaid = self.ticket('2026-09-01T14:00:00Z')
        legacy = self.ticket('2026-09-01T14:00:00Z')
        with main.db() as conn:
            conn.execute('UPDATE repair_orders SET paid_at=?, status=?, estimate_total=? WHERE id=?', ('2026-09-01T15:00:00Z', 'paid', 999, legacy))
        report = self.report('2026-09-01')
        self.assertEqual(report['totals'], {'visits': 2, 'paid_tickets': 1, 'income_cents': 0, 'missing_amounts': 1})
        self.pay(legacy, '2026-09-05T15:00:00Z', '120.00')
        self.assertEqual(self.report('2026-09-01')['totals']['income_cents'], 12000)
        self.assertEqual(self.report('2026-09-05')['totals']['income_cents'], 0)

    def test_dst_and_leap_month(self):
        for date, start, last, next_day in (
            ('2026-03-08', '2026-03-08T05:00:00Z', '2026-03-09T03:59:59Z', '2026-03-09T04:00:00Z'),
            ('2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T04:59:59Z', '2026-11-02T05:00:00Z'),
        ):
            for created in (start, last, next_day):
                self.ticket(created)
            self.assertEqual(self.report(date)['totals']['visits'], 2)
        leap = self.report('2024-02-10', 'month')
        self.assertEqual(len(leap['days']), 29)
        self.assertEqual(leap['totals']['income_cents'], 0)

    def test_invalid_dates_and_amounts(self):
        ticket = self.ticket('2026-09-01T14:00:00Z')
        for amount in ('-1', '1.001', 'NaN'):
            self.assertEqual(self.client.post(f'/api/orders/{ticket}/paid', json={'amount': amount}).status_code, 422)
        self.assertEqual(self.client.get('/api/reports/income?on=not-a-date').status_code, 422)
        self.assertEqual(self.client.get('/api/reports/income?period=year').status_code, 422)
