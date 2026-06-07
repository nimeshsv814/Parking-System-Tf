import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback(({ title, description, tone = "info" }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, title, description, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`glass-panel animate-rise p-4 ${
              toast.tone === "success"
                ? "border-mint/40"
                : toast.tone === "error"
                  ? "border-ember/40"
                  : "border-amber/30"
            }`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-1 text-sm text-slate">{toast.description}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};
