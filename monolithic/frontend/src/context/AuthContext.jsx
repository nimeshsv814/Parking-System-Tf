import { createContext, useContext, useEffect, useState } from "react";
import { authApi, getApiError } from "../api/client";

const AuthContext = createContext(null);

const parseToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch (_error) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("smartParkingToken"));
  const [user, setUser] = useState(() => {
    const storedToken = localStorage.getItem("smartParkingToken");
    return storedToken ? parseToken(storedToken) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    setUser(parseToken(token));
  }, [token]);

  const storeAuth = (nextToken) => {
    localStorage.setItem("smartParkingToken", nextToken);
    setToken(nextToken);
  };

  const clearAuth = () => {
    localStorage.removeItem("smartParkingToken");
    setToken(null);
    setUser(null);
  };

  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await authApi.post("/login", credentials);
      storeAuth(response.data.token);
      return response.data.user;
    } catch (error) {
      throw new Error(getApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const response = await authApi.post("/register", payload);
      storeAuth(response.data.token);
      return response.data.user;
    } catch (error) {
      throw new Error(getApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: Boolean(token && user),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

