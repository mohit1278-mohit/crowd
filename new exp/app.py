from flask import Flask, jsonify, Response
from flask_cors import CORS
import cv2
from ultralytics import YOLO
import threading
import torch

app = Flask(__name__)
CORS(app)

# Detect GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Running on:", device)

# Load YOLO model
model = YOLO("yolov8m.pt").to(device)

# Open camera
cap = cv2.VideoCapture(0)

# Camera resolution (important)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

people_count = 0
stable_count = 0
output_frame = None

CONFIDENCE_THRESHOLD = 0.4


# API to send people count to frontend
@app.route("/count")
def get_count():
    return jsonify({"people": stable_count})


# Detection Thread
def detect_people():
    global people_count, output_frame, stable_count

    last_counts = []

    while True:
        ret, frame = cap.read()

        if not ret:
            continue

        overlay = frame.copy()

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

                # Transparent detection panel
                cv2.rectangle(overlay, (x1, y1), (x2, y2), (255, 200, 0), -1)

                # Border
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 0), 2)

                # AI corner style
                line = 15
                cv2.line(frame, (x1, y1), (x1 + line, y1), (255, 255, 0), 3)
                cv2.line(frame, (x1, y1), (x1, y1 + line), (255, 255, 0), 3)

                cv2.line(frame, (x2, y1), (x2 - line, y1), (255, 255, 0), 3)
                cv2.line(frame, (x2, y1), (x2, y1 + line), (255, 255, 0), 3)

                cv2.line(frame, (x1, y2), (x1 + line, y2), (255, 255, 0), 3)
                cv2.line(frame, (x1, y2), (x1, y2 - line), (255, 255, 0), 3)

                cv2.line(frame, (x2, y2), (x2 - line, y2), (255, 255, 0), 3)
                cv2.line(frame, (x2, y2), (x2, y2 - line), (255, 255, 0), 3)

                # Label
                cv2.putText(frame, "PERSON",
                            (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.6,
                            (255, 255, 0),
                            2)

        # Transparent blend
        alpha = 0.25
        frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

        # Smooth count
        last_counts.append(count)
        if len(last_counts) > 10:
            last_counts.pop(0)

        stable_count = int(sum(last_counts) / len(last_counts))

        # Show count on video
        cv2.rectangle(frame, (10, 10), (280, 70), (0, 0, 0), -1)
        cv2.putText(frame,
                    f"People: {stable_count}",
                    (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.2,
                    (0, 255, 255),
                    3)

        output_frame = frame


# Video stream generator
def generate_frames():
    global output_frame

    while True:
        if output_frame is None:
            continue

        ret, buffer = cv2.imencode('.jpg', output_frame)
        frame = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')


# Video API
@app.route("/video")
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


# Start detection thread
threading.Thread(target=detect_people, daemon=True).start()


# Run server
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, threaded=True)