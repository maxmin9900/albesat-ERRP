# Default: Docker Hub. Iran/mirror: PYTHON_IMAGE=docker.arvancloud.ir/library/python:3.11-slim
ARG PYTHON_IMAGE=python:3.11-slim
FROM ${PYTHON_IMAGE}

WORKDIR /app

# No apt packages needed: asyncpg, bcrypt and cryptography all ship manylinux
# wheels for cpython 3.11-slim. Skipping apt-get avoids a flaky network layer.
ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/dev.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
