"""
Ocean Vision ESP32-CAM - Perceptual Hashing & Deduplication Engine
Pure in-memory, zero-disk-persistence implementation.
Computes SHA-256 for exact match and dHash (64-bit) for perceptual near-duplicate detection.
"""

import hashlib
import io
from typing import Tuple
from PIL import Image


def compute_sha256(image_bytes: bytes) -> str:
    """Computes standard SHA-256 hex digest of raw image bytes."""
    hasher = hashlib.sha256()
    hasher.update(image_bytes)
    return hasher.hexdigest()


def compute_dhash(image_bytes: bytes, hash_size: int = 8) -> str:
    """
    Computes 64-bit Difference Hash (dHash) directly from in-memory JPEG bytes.
    Zero disk I/O.
    
    1. Reads bytes into PIL.Image via io.BytesIO.
    2. Converts to 8-bit grayscale.
    3. Downsamples to (hash_size + 1, hash_size) - default (9, 8).
    4. Computes row-wise horizontal gradient differences.
    5. Encodes 64 boolean bits as a 16-character hexadecimal string.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        # Convert to grayscale
        gray = img.convert("L")
        # Resize to (width = hash_size + 1, height = hash_size)
        resized = gray.resize((hash_size + 1, hash_size), Image.Resampling.BILINEAR)
        if hasattr(resized, "get_flattened_data"):
            pixels = list(resized.get_flattened_data())
        else:
            pixels = list(resized.getdata())

    # Calculate differences between adjacent pixels
    diff = []
    for row in range(hash_size):
        row_offset = row * (hash_size + 1)
        for col in range(hash_size):
            pixel_left = pixels[row_offset + col]
            pixel_right = pixels[row_offset + col + 1]
            diff.append(pixel_left > pixel_right)

    # Convert binary array to 64-bit integer
    decimal_val = 0
    for idx, bit in enumerate(diff):
        if bit:
            decimal_val |= 1 << (63 - idx)

    # Format as 16-character hex string (zero-padded)
    return f"{decimal_val:016x}"


def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Calculates the Hamming distance (number of bit differences)
    between two hexadecimal perceptual hash strings.
    """
    if len(hash1) != len(hash2):
        raise ValueError(f"Hash lengths do not match: {len(hash1)} vs {len(hash2)}")
    
    val1 = int(hash1, 16)
    val2 = int(hash2, 16)
    xor_result = val1 ^ val2
    return bin(xor_result).count("1")


def is_near_duplicate(hash1: str, hash2: str, max_distance: int = 8) -> Tuple[bool, int]:
    """
    Evaluates whether two images are perceptual near-duplicates.
    Returns (is_duplicate: bool, distance: int).
    Default threshold is distance <= 8 (over 64 bits = ~87.5% similarity).
    """
    dist = hamming_distance(hash1, hash2)
    return dist <= max_distance, dist
