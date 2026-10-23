import serial
import time

for baud in [2000000, 115200]:
    print(f"\n--- Checking COM4 @ {baud} baud ---")
    try:
        ser = serial.Serial("COM4", baud, timeout=1.0)
        # Pulse RTS to reset ESP32
        ser.dtr = False
        ser.rts = True
        time.sleep(0.1)
        ser.rts = False
        time.sleep(1.0)
        
        # Read whatever comes out
        data = ser.read(ser.in_waiting or 2048)
        print("Raw bytes read:", len(data))
        try:
            print("Decoded text:\n", data.decode("utf-8", errors="replace"))
        except Exception as e:
            print("Cannot decode:", e)
        ser.close()
    except Exception as e:
        print("Error:", e)
