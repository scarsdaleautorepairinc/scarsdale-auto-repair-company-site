FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app /app/backend/app
RUN useradd --system --uid 10001 shop
USER shop
ENV SHOP_ENV=production SHOP_DATA_DIR=/data
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8091"]
