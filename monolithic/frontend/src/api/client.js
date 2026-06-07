import axios from "axios";

const createClient = (baseURL) => {
  const client = axios.create({ baseURL });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem("smartParkingToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
};

export const authApi = createClient(import.meta.env.VITE_AUTH_SERVICE_URL);
export const parkingApi = createClient(import.meta.env.VITE_PARKING_SERVICE_URL);
export const bookingApi = createClient(import.meta.env.VITE_BOOKING_SERVICE_URL);
export const paymentApi = createClient(import.meta.env.VITE_PAYMENT_SERVICE_URL);
export const notificationApi = createClient(import.meta.env.VITE_NOTIFICATION_SERVICE_URL);

export const getApiError = (error) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || "Something went wrong";

