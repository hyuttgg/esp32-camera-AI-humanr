"""
Ocean Vision ESP32-CAM - Python Vision Worker Service
Consumes image processing tasks from RabbitMQ (or runs in standalone CLI verification mode).
Adheres strictly to the Zero-Disk-Persistence rule: all images remain in RAM.
"""

import os
import sys
import io
import json
import time
import logging
from typing import Optional
from dedup_engine import compute_sha256, compute_dhash, is_near_duplicate
from vision_engine import VisionEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("VisionWorker")

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
QUEUE_INCOMING = os.getenv("VISION_QUEUE_INCOMING", "ocean_vision.jobs")
QUEUE_RESULTS = os.getenv("VISION_QUEUE_RESULTS", "ocean_vision.results")


class VisionWorker:
    def __init__(self):
        self.engine = VisionEngine()
        self.known_hashes = {}  # device_id -> last_dhash for in-memory near-dup checking

    def process_image(self, device_id: str, image_bytes: bytes) -> dict:
        """
        Executes end-to-end memory-only pipeline:
        1. SHA-256
        2. dHash
        3. Near-duplicate evaluation vs previous frame for device
        4. Person presence & low-light analysis
        """
        sha256_hash = compute_sha256(image_bytes)
        dhash_str = compute_dhash(image_bytes)
        
        # Deduplication check
        is_dup = False
        dist = 64
        last_hash = self.known_hashes.get(device_id)
        if last_hash:
            is_dup, dist = is_near_duplicate(last_hash, dhash_str, max_distance=8)
        
        # Update device's latest hash if not duplicate or if first frame
        if not is_dup:
            self.known_hashes[device_id] = dhash_str

        # Vision engine analysis (only necessary if not duplicate or for verification)
        analysis = self.engine.analyze_frame(image_bytes)

        result = {
            "device_id": device_id,
            "sha256": sha256_hash,
            "dhash": dhash_str,
            "is_duplicate": is_dup,
            "hamming_distance": dist,
            "person_detected": analysis["person_detected"],
            "confidence": analysis["confidence"],
            "detections": analysis["detections"],
            "lighting": analysis["lighting"],
            "latency_ms": analysis["latency_ms"],
            "timestamp": time.time()
        }

        return result

    def start_amqp_consumer(self):
        """Connects to RabbitMQ and listens for processing tasks."""
        try:
            import pika
        except ImportError:
            logger.error("pika library not installed. Install via `pip install pika`.")
            return

        logger.info(f"Connecting to RabbitMQ at {RABBITMQ_URL}...")
        try:
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            channel.queue_declare(queue=QUEUE_INCOMING, durable=True)
            channel.queue_declare(queue=QUEUE_RESULTS, durable=True)
            logger.info(f"Subscribed to queue: {QUEUE_INCOMING}")

            def callback(ch, method, properties, body):
                try:
                    payload = json.loads(body)
                    device_id = payload.get("device_id", "unknown")
                    # Support direct base64 bytes or binary payload
                    import base64
                    img_data = base64.b64decode(payload.get("image_base64", ""))
                    
                    res = self.process_image(device_id, img_data)
                    
                    # Publish result
                    channel.basic_publish(
                        exchange="",
                        routing_key=QUEUE_RESULTS,
                        body=json.dumps(res),
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                except Exception as ex:
                    logger.error(f"Error processing message: {ex}")
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

            channel.basic_consume(queue=QUEUE_INCOMING, on_message_callback=callback)
            channel.start_consuming()
        except Exception as e:
            logger.warning(f"RabbitMQ connection failed: {e}. Running in standalone test mode.")


if __name__ == "__main__":
    worker = VisionWorker()
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Generate synthetic in-memory test image
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (320, 240), color=(10, 25, 45))
        d = ImageDraw.Draw(img)
        d.ellipse([100, 50, 220, 190], fill=(200, 200, 200))
        
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        raw_bytes = buf.getvalue()

        logger.info("Executing Standalone Zero-Disk RAM Ingestion Test...")
        res = worker.process_image("ESP32-CAM-DEV-001", raw_bytes)
        print("\n--- Worker Processing Result ---")
        print(json.dumps(res, indent=2))
        
        # Test near-dup with identical image
        res2 = worker.process_image("ESP32-CAM-DEV-001", raw_bytes)
        print(f"\nSecond frame is_duplicate: {res2['is_duplicate']} (distance={res2['hamming_distance']})")
        assert res2["is_duplicate"] is True, "Second identical frame must be detected as duplicate!"
        print("[OK] Deduplication verified successfully!")
    else:
        worker.start_amqp_consumer()
