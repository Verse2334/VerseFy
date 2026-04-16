import { useEffect, useState } from 'react';
import { getConfig, onConfigChange, getVideoBlobUrl } from '../utils/videoBg';
import './VideoBackground.css';

export default function VideoBackground() {
  const [config, setConfig] = useState(getConfig);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    return onConfigChange(() => setConfig(getConfig()));
  }, []);

  // Load the active video's blob URL
  useEffect(() => {
    let revoked = null;
    setBlobUrl(null);
    if (config.enabled && config.activeVideoId) {
      getVideoBlobUrl(config.activeVideoId).then(url => {
        setBlobUrl(url);
        revoked = url;
      }).catch(() => {});
    }
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [config.enabled, config.activeVideoId]);

  // Body class to enable transparent layout layers
  useEffect(() => {
    if (config.enabled && blobUrl) document.body.classList.add('video-bg-active');
    else document.body.classList.remove('video-bg-active');
    return () => document.body.classList.remove('video-bg-active');
  }, [config.enabled, blobUrl]);

  if (!config.enabled || !blobUrl) return null;

  const dim = 1 - (config.opacity ?? 0.5);
  return (
    <div className="video-bg-wrap" style={{ '--video-bg-dim': dim }}>
      <video
        className="video-bg-video"
        src={blobUrl}
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="video-bg-overlay" />
    </div>
  );
}
