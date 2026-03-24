import React, { useEffect, useRef, useState } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

// Defensive constructor helpers for MediaPipe in Vite bundles
const HandsConstructor = (Hands as any).Hands || Hands;
const CameraConstructor = (Camera as any).Camera || Camera;
import neutralDefault from '../photo/neutral.png';
import sadDefault from '../photo/sad.png';
import happyDefault from '../photo/happy.png';
import surpriseDefault from '../photo/surprise.png';

interface PhotoItem {
  id: number;
  gesture: string;
  name: string;
  url: string;
  label: string;
}

const INITIAL_PHOTOS: PhotoItem[] = [
  { id: 0, gesture: 'Fist', name: 'Neutral', url: neutralDefault, label: '✊ 주먹 (Neutral)' },
  { id: 1, gesture: 'T-Shape', name: 'Sad', url: sadDefault, label: '☝️ T자/검지 (Sad)' },
  { id: 2, gesture: 'Thumb', name: 'Happy', url: happyDefault, label: '👍 엄지척 (Happy)' },
  { id: 3, gesture: 'Open', name: 'Surprise', url: surpriseDefault, label: '🖐️ 보자기 (Surprise)' },
];

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoItem[]>(INITIAL_PHOTOS);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [recognizedGesture, setRecognizedGesture] = useState('Wait...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<number | null>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const hands = new (HandsConstructor as any)({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: Results) => {
      const canvasCtx = canvasRef.current!.getContext('2d')!;
      canvasCtx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
          drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
          drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

          processGesture(landmarks);
        }
      } else {
        setRecognizedGesture('Fist (주먹)');
        setCurrentPhotoIdx(0);
      }
    });

    const camera = new (CameraConstructor as any)(videoRef.current, {
      onFrame: async () => {
        await hands.send({ image: videoRef.current! });
      },
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, []);

  const processGesture = (landmarks: any[]) => {
    const getDist = (p1: any, p2: any) => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const wrist = landmarks[0];
    const isExtended = (tipIdx: number, pipIdx: number) => {
      return getDist(wrist, landmarks[tipIdx]) > getDist(wrist, landmarks[pipIdx]) * 1.1;
    };

    const thumbExtended = getDist(landmarks[4], landmarks[9]) > getDist(landmarks[3], landmarks[9]);
    const indexExtended = isExtended(8, 6);
    const middleExtended = isExtended(12, 10);
    const ringExtended = isExtended(16, 14);
    const pinkyExtended = isExtended(20, 18);

    let gestureName = 'Wait...';
    let newIdx = currentPhotoIdx;

    const extendedCount = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

    if (thumbExtended && extendedCount === 4) {
      gestureName = 'Open Hand (보자기)';
      newIdx = 3;
    } else if (thumbExtended && extendedCount === 0) {
      gestureName = 'Thumbs Up (엄지척)';
      newIdx = 2;
    } else if (indexExtended && extendedCount === 1) {
      gestureName = 'T-Shape (T자)';
      newIdx = 1;
    } else if (!thumbExtended && extendedCount === 0) {
      gestureName = 'Fist (주먹)';
      newIdx = 0;
    }

    setRecognizedGesture(gestureName);
    setCurrentPhotoIdx(newIdx);
  };

  const triggerUpload = (id: number) => {
    setActiveUploadId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && activeUploadId !== null) {
      const newUrl = URL.createObjectURL(file);
      setPhotos(prev => prev.map(p => p.id === activeUploadId ? { ...p, url: newUrl } : p));
    }
    event.target.value = ''; // Reset for same file upload
  };

  return (
    <div className="app-container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleFileChange}
      />

      <div className="gesture-status">
        Gesture: {recognizedGesture}
      </div>

      <div className="gallery-container">
        <img
          key={photos[currentPhotoIdx].url} // Key to trigger re-animation
          src={photos[currentPhotoIdx].url}
          alt={photos[currentPhotoIdx].name}
          className="photo-display active"
        />
      </div>

      <div className="instructions">
        <strong>Custom Photos (Click to change):</strong>
        <ul>
          {photos.map(photo => (
            <li key={photo.id} onClick={() => triggerUpload(photo.id)} className="clickable-instruction">
              {photo.label} <span className="upload-hint">✎</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="camera-preview">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} width="240" height="180" />
      </div>
    </div>
  );
};

export default App;
