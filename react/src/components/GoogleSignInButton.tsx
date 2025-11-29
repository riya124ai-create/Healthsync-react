import { useEffect, useRef } from "react";

type ButtonOptions = {
  theme?: "outline" | "filled_black" | "filled_blue";
  size?: "large" | "medium" | "small";
};

type Props = {
  clientId?: string;
  onCredential: (credential: string) => void;
  buttonOptions?: ButtonOptions;
  className?: string;
};

export function GoogleSignInButton({ clientId, onCredential, buttonOptions, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = clientId ?? (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);
    if (!id) {
      console.warn("VITE_GOOGLE_CLIENT_ID not set");
      return;
    }

    function handleResponse(response: any) {
      if (response?.credential) onCredential(response.credential);
    }

    function renderButton() {
      try {
        ;(window as any).google.accounts.id.initialize({ client_id: id, callback: handleResponse });
        if (containerRef.current) {
          (window as any).google.accounts.id.renderButton(containerRef.current, {
            theme: buttonOptions?.theme ?? "outline",
            size: buttonOptions?.size ?? "large",
          });
        }
      } catch (err) {
        console.debug("google button render failed", err);
      }
    }

    if (!(window as any).google) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = renderButton;
      document.head.appendChild(s);
      return () => {
        try { document.head.removeChild(s); } catch (e) { /* ignore */ }
      };
    } else {
      renderButton();
    }
  }, [clientId, onCredential, buttonOptions]);

  return <div ref={containerRef} className={className} />;
}

export default GoogleSignInButton;
