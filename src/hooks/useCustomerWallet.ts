import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";

export const useCustomerWallet = () => {
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!user) {
        setCoins(0);
        setUserId(null);
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      const userRef = doc(db, "users", user.uid);
      unsubscribeDoc = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const currentCoins = Number(
              data.tongCoins ?? 
              data.tc_balance ?? 
              data.tongcoins ?? 
              data.balance ?? 
              0
            );
            setCoins(currentCoins);
          } else {
            setCoins(0);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Wallet listener error:", err);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  return { coins, loading, userId };
};

export default useCustomerWallet;
