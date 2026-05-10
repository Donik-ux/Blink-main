import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../api/auth.js';
import { useAuthStore } from '../store/authStore.js';
import { useNavigate } from 'react-router-dom';

export const GoogleSignInButton = ({ onError }) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const setAuthState = useAuthStore();
  const navigate = useNavigate();

  if (!clientId) {
    // Тихий no-op если ключ не задан в .env
    return null;
  }

  const handleSuccess = async (credResp) => {
    try {
      const data = await googleLogin(credResp.credential);
      setAuthState.setTokens({ token: data.token, refreshToken: data.refreshToken });
      setAuthState.setUser(data.user);
      navigate('/map');
    } catch (e) {
      onError?.(e.response?.data?.error || 'Не удалось войти через Google');
    }
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="w-full flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => onError?.('Ошибка Google входа')}
          theme="filled_black"
          size="large"
          shape="pill"
          text="continue_with"
          width="320"
        />
      </div>
    </GoogleOAuthProvider>
  );
};
