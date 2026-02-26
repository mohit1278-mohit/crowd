from flask import Flask, jsonify, Response
from flask_cors import CORS
import cv2
from ultralytics import YOLO
import threading
import torch
import time

app = Flask(__name__)
CORS(app)

device = "cuda" if torch.cuda.is_available() else "cpu"
print("Running on:", device)

# Use better model
model = YOLO("yolov8m.pt").to(device)

cap = cv2.VideoCapture(1)

cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

people_count = 0
stable_count = 0
output_frame = None

CONFIDENCE_THRESHOLD = 0.4


@app.route("/count")
def get_count():
    return jsonify({"people": stable_count})


def detect_people():
    global people_count, output_frame, stable_count

    last_counts = []

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        results = model(frame, imgsz=416, conf=CONFIDENCE_THRESHOLD, device=device)

        count = 0

        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])

                # Only detect PERSON
                if cls != 0:
                    continue

                conf = float(box.conf[0])
                if conf < CONFIDENCE_THRESHOLD:
                    continue

                count += 1

                x1, y1, x2, y2 = map(int, box.xyxy[0])

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Smooth the count (reduce blinking)
        last_counts.append(count)
        if len(last_counts) > 10:
            last_counts.pop(0)

        stable_count = int(sum(last_counts) / len(last_counts))

        cv2.putText(frame, f"People: {stable_count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)

        output_frame = frame


def generate_frames():
    global output_frame

    while True:
        if output_frame is None:
            continue

        ret, buffer = cv2.imencode('.jpg', output_frame)
        frame = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')


@app.route("/video")
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


threading.Thread(target=detect_people, daemon=True).start()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)