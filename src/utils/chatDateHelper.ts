export function getMessageDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (typeof timestamp?.toDate === "function") return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "number") return new Date(timestamp);
  if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
  if (typeof timestamp === "string") {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function format24HourTime(timestamp: any): string {
  if (!timestamp) return "";
  try {
    const d = getMessageDate(timestamp);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(/\./g, ":");
  } catch {
    return "";
  }
}

export function shouldShowDateDivider(currMsg: any, prevMsg: any): boolean {
  if (!currMsg) return false;
  if (!prevMsg) return true;

  const currDate = getMessageDate(currMsg.timestampNumber || currMsg.createdAt);
  const prevDate = getMessageDate(prevMsg.timestampNumber || prevMsg.createdAt);

  return (
    currDate.getFullYear() !== prevDate.getFullYear() ||
    currDate.getMonth() !== prevDate.getMonth() ||
    currDate.getDate() !== prevDate.getDate()
  );
}

export function formatDateDivider(dateInput: any): string {
  try {
    const date = getMessageDate(dateInput);
    if (isNaN(date.getTime())) return "";

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      return "Hari Ini";
    }

    if (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    ) {
      return "Kemarin";
    }

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return "";
  }
}
