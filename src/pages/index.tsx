import React, { useEffect } from "react";
import { useRouter } from "next/router";

export default function MainPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the editor page on app start
    router.push("/editor");
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontSize: '18px'
    }}>
      Redirecting to Template Designer...
    </div>
  );
}