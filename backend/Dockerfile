FROM python:3.9-slim
RUN apt-get update && apt-get install -y ffmpeg curl gnupg lsb-release && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get install -y docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/data && chown -R 1000:100 /app
ENV PYTHONUNBUFFERED=1
ENV MUSIC_DIR=/music
EXPOSE 8000
USER 1000:100
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
