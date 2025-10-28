FROM python:3.9-alpine

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1


WORKDIR /app

COPY ./requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY backend /app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]
