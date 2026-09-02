import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export const dispatchCatalogActionBubble = async (
  chatId: string,
  category: "GIFT" | "JOKI"
) => {
  if (!chatId) return;

  const isGift = category === "GIFT";
  const actionCard = {
    type: "OPEN_CATALOG_MODAL",
    targetCategory: category,
    title: isGift ? "Katalog Gift In Game" : "Katalog Joki Game",
    description: isGift
      ? "Buka katalog untuk melihat pilihan gamepass & item game terlengkap di Entong Store."
      : "Buka katalog untuk melihat layanan joki leveling, stats, & quest terlengkap di Entong Store.",
    buttonLabel: isGift ? "Buka Katalog Gift In Game" : "Buka Katalog Joki Game",
    routePath: isGift ? "/catalog?cat=gift" : "/catalog?cat=joki"
  };

  const text = isGift
    ? "Mimin bantu bukain katalog Gift Ingame yaa!"
    : "Mimin bantu bukain katalog Joki Game yaa!";

  await addDoc(collection(db, "chats", chatId, "messages"), {
    text,
    message: text,
    sender: "admin",
    senderRole: "RESMI",
    sender_role: "ADMIN",
    senderName: "Bot Entong Store",
    sender_name: "Bot Entong Store",
    isOfficialBot: true,
    actionCard,
    createdAt: serverTimestamp(),
    createdAtMillis: Date.now()
  });

  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: text,
    last_message: text,
    lastSender: "admin",
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};
