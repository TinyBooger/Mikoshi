import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

const EXIT_CONFIRMATION_WINDOW_MS = 2000;

export function useAppBackButton() {
  const navigate = useNavigate();
  const lastBackPressAtRef = useRef(0);

  useEffect(() => {
    if (!navigator.userAgent.includes('YubandaoApp')) return undefined;

    let disposed = false;
    let plusApi = null;
    let readyListener = null;

    const handleBackButton = () => {
      const historyIndex = window.history.state?.idx;
      if (typeof historyIndex === 'number' && historyIndex > 0) {
        lastBackPressAtRef.current = 0;
        navigate(-1);
        return;
      }

      const now = Date.now();
      if (now - lastBackPressAtRef.current <= EXIT_CONFIRMATION_WINDOW_MS) {
        plusApi.runtime.quit();
        return;
      }

      lastBackPressAtRef.current = now;
      plusApi.nativeUI.toast('Press back again to exit');
    };

    const registerBackButton = () => {
      if (disposed) return;
      plusApi = window.plus;
      if (!plusApi) {
        console.error('YubandaoApp back button: plus is unavailable after plusready.');
        return;
      }
      plusApi.key.addEventListener('backbutton', handleBackButton);
    };

    if (window.plus) {
      registerBackButton();
    } else {
      readyListener = registerBackButton;
      document.addEventListener('plusready', readyListener, { once: true });
    }

    return () => {
      disposed = true;
      if (readyListener) {
        document.removeEventListener('plusready', readyListener);
      }
      if (plusApi) {
        plusApi.key.removeEventListener('backbutton', handleBackButton);
      }
    };
  }, [navigate]);
}
