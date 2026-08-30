FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
RUN useradd --create-home appuser && chown -R appuser:appuser /app
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER appuser
ENTRYPOINT ["/entrypoint.sh"]
