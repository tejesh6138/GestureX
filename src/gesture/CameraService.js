/**
 * AI Gesture Runner 3D - CameraService
 * Robust webcam stream lifecycle management with support for mobile front camera,
 * multi-device webcam selection, secure context validation, and verified video frame readiness.
 */

import { GlobalEvents, EVENTS } from '../core/EventBus.js';

export const CAMERA_STATES = {
  UNINITIALIZED: 'UNINITIALIZED',
  REQUESTING_PERMISSION: 'REQUESTING_PERMISSION',
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
  ERROR: 'ERROR',
  STOPPED: 'STOPPED'
};

export class CameraService {
  constructor() {
    this.videoElement = null;
    this.stream = null;
    this.isReady = false;
    this.hasPermission = false;
    this.state = CAMERA_STATES.UNINITIALIZED;
    this.facingMode = 'user'; // Front selfie camera preferred on mobile
    this.selectedDeviceId = null;
    this.lastError = null;
    this.availableDevices = [];
    this.cameraFps = 0;
    this.cameraFrameCount = 0;
    this.cameraFpsLastCalc = performance.now();
    this.frameCallbackId = null;
  }

  isSupported() {
    return !!(
      navigator?.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    );
  }

  createVideoElement() {
    if (this.videoElement) return this.videoElement;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    // Off-screen rendering instead of display:none to guarantee GPU frame decoding across browsers
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '320px';
    video.style.height = '240px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-999';

    document.body.appendChild(video);
    this.videoElement = video;
    return video;
  }

  async getCameraDevices() {
    if (!this.isSupported()) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter((d) => d.kind === 'videoinput');
      return this.availableDevices;
    } catch (e) {
      console.warn('[CameraService] Failed to enumerate video devices:', e);
      return [];
    }
  }

  async requestCamera(preferredDeviceId = null) {
    if (!this.isSupported()) {
      const err = new Error(
        window.isSecureContext === false
          ? 'Camera requires a secure context (HTTPS or localhost).'
          : 'Webcam access is not supported by this browser.'
      );
      this.state = CAMERA_STATES.UNAVAILABLE;
      this.lastError = err.message;
      GlobalEvents.emit(EVENTS.CAMERA_ERROR, { error: err, message: err.message });
      return { success: false, message: err.message, error: err };
    }

    // Stop any existing stream cleanly before opening a new one
    this.stop();

    this.state = CAMERA_STATES.REQUESTING_PERMISSION;
    this.createVideoElement();

    try {
      // Optimized lightweight video constraints: 320x240 provides razor-sharp landmark
      // recognition while cutting video texture transfer and preprocessing time by 75%.
      // Request ideal 60 FPS so capable webcams deliver high-speed 50-60 FPS frames.
      const videoConstraints = {
        width: { ideal: 320, max: 480 },
        height: { ideal: 240, max: 360 },
        frameRate: { ideal: 60, min: 30 }
      };

      if (preferredDeviceId) {
        videoConstraints.deviceId = { exact: preferredDeviceId };
      } else {
        videoConstraints.facingMode = this.facingMode;
      }

      this.state = CAMERA_STATES.INITIALIZING;

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints
        });
      } catch (firstErr) {
        // Fallback to basic video constraint if strict resolution/device constraints rejected
        console.warn('[CameraService] Ideal constraints failed, falling back to basic video:', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
      }

      this.stream = stream;
      this.videoElement.srcObject = stream;

      // Wait for valid metadata and actual decoded video frame
      await this.waitForVideoReady(this.videoElement);

      this.isReady = true;
      this.hasPermission = true;
      this.state = CAMERA_STATES.READY;
      this.lastError = null;

      // Start actual decoded frame rate monitoring
      this.startFrameMonitoring();

      // Cache active device ID
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        this.selectedDeviceId = settings.deviceId || null;
      }

      // Refresh available devices list now that permission is granted
      this.getCameraDevices().catch(() => {});

      GlobalEvents.emit(EVENTS.CAMERA_READY, { video: this.videoElement });
      console.log(`[CameraService] Camera ready: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);

      return {
        success: true,
        video: this.videoElement,
        width: this.videoElement.videoWidth,
        height: this.videoElement.videoHeight
      };
    } catch (err) {
      this.isReady = false;
      this.hasPermission = false;
      this.stop();

      let errorMsg = 'Could not access camera. Please check browser permissions.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.state = CAMERA_STATES.PERMISSION_DENIED;
        errorMsg = 'Camera permission denied. Please allow camera access in your browser address bar.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.state = CAMERA_STATES.UNAVAILABLE;
        errorMsg = 'No camera device was detected on your system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        this.state = CAMERA_STATES.UNAVAILABLE;
        errorMsg = 'Camera is currently in use by another application or tab.';
      } else {
        this.state = CAMERA_STATES.ERROR;
        errorMsg = `Camera error: ${err.message || 'Unknown initialization failure'}`;
      }

      this.lastError = errorMsg;
      GlobalEvents.emit(EVENTS.CAMERA_ERROR, { error: err, message: errorMsg });
      console.error('[CameraService] Request camera failed:', err);

      return { success: false, message: errorMsg, error: err };
    }
  }

  /**
   * Robust promise resolving once video metadata is loaded, video is playing,
   * and dimensions are non-zero.
   */
  waitForVideoReady(video) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
        } else {
          reject(new Error('Camera video stream timed out waiting for frames.'));
        }
      }, 7000);

      const checkReady = () => {
        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          clearTimeout(timeout);
          resolve();
          return true;
        }
        return false;
      };

      if (checkReady()) return;

      const onLoaded = () => {
        video.play().then(() => {
          if (!checkReady()) {
            video.addEventListener('timeupdate', () => checkReady(), { once: true });
          }
        }).catch((err) => {
          console.warn('[CameraService] video.play() warning:', err);
          // Still try resolving if frames are already decoding
          if (!checkReady()) {
            clearTimeout(timeout);
            reject(err);
          }
        });
      };

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        onLoaded();
      } else {
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
      }
    });
  }

  startFrameMonitoring() {
    if (!this.videoElement) return;

    if (typeof this.videoElement.requestVideoFrameCallback === 'function') {
      const onFrame = (now) => {
        if (!this.stream || !this.isReady) return;
        this.cameraFrameCount++;
        const elapsed = now - this.cameraFpsLastCalc;
        if (elapsed >= 500) {
          this.cameraFps = Math.round((this.cameraFrameCount * 1000) / elapsed);
          this.cameraFrameCount = 0;
          this.cameraFpsLastCalc = now;
        }
        if (this.videoElement && this.stream && this.isReady) {
          this.frameCallbackId = this.videoElement.requestVideoFrameCallback(onFrame);
        }
      };
      this.frameCallbackId = this.videoElement.requestVideoFrameCallback(onFrame);
    }
  }

  getVideo() {
    return this.videoElement;
  }

  stop() {
    if (this.frameCallbackId && this.videoElement && typeof this.videoElement.cancelVideoFrameCallback === 'function') {
      try {
        this.videoElement.cancelVideoFrameCallback(this.frameCallbackId);
      } catch (e) {}
      this.frameCallbackId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.stream = null;
    }

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.srcObject = null;
      } catch (e) {}
    }

    this.isReady = false;
    this.cameraFps = 0;
    this.cameraFrameCount = 0;
    this.state = CAMERA_STATES.STOPPED;
  }

  getDiagnostics() {
    let configuredFps = 0;
    if (this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        configuredFps = track.getSettings()?.frameRate || 0;
      }
    }

    return {
      supported: this.isSupported(),
      secureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
      state: this.state,
      isReady: this.isReady,
      hasPermission: this.hasPermission,
      videoWidth: this.videoElement ? this.videoElement.videoWidth : 0,
      videoHeight: this.videoElement ? this.videoElement.videoHeight : 0,
      readyState: this.videoElement ? this.videoElement.readyState : 0,
      streamActive: this.stream ? this.stream.active : false,
      deviceId: this.selectedDeviceId,
      availableCameras: this.availableDevices.length,
      fps: this.cameraFps > 0 ? this.cameraFps : (configuredFps > 0 ? Math.round(configuredFps) : 0),
      lastError: this.lastError
    };
  }
}

export const Camera = new CameraService();
