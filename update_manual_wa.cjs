const fs = require('fs');
let content = fs.readFileSync('src/components/admin/ManualWAOrderModal.tsx', 'utf8');

const newSubmitLogic = `  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    let manualCleanPhone = phoneInput.replace(/\\D/g, '');
    let standardPhone = manualCleanPhone;
    if (standardPhone.startsWith('0')) standardPhone = '62' + standardPhone.slice(1);
    if (standardPhone.startsWith('8')) standardPhone = '62' + standardPhone;

    if (!standardPhone || standardPhone.length < 8) {
      setErrorMessage('Nomor WhatsApp Customer wajib diisi dengan benar (min. 8 digit).');
      return;
    }

    const trimmedRobloxUser = robloxUsername.trim();
    if (!trimmedRobloxUser) {
      setErrorMessage('Username Roblox target wajib diisi.');
      return;
    }

    if (selectedItems.length === 0) {
      setErrorMessage('Silakan pilih minimal satu paket layanan dari katalog.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 0. AUTO-LOOKUP & BINDING KE AKUN USER
      const phoneVariations = [
        manualCleanPhone,
        standardPhone,
        manualCleanPhone.startsWith('62') ? '0' + manualCleanPhone.slice(2) : manualCleanPhone,
        manualCleanPhone.startsWith('0') ? '62' + manualCleanPhone.slice(1) : '62' + manualCleanPhone,
        '+' + standardPhone
      ];
      const uniquePhones = [...new Set(phoneVariations)].slice(0, 10);

      const usersRef = collection(db, "users");
      let existingUser = null;
      
      const qUsers = query(usersRef, where("whatsapp", "in", uniquePhones));
      const userSnap = await getDocs(qUsers);
      
      if (!userSnap.empty) {
        const docData = userSnap.docs[0].data();
        existingUser = { 
          uid: userSnap.docs[0].id, 
          name: docData.displayName || docData.fullName || docData.name || docData.username || 'Customer',
          ...docData 
        };
      } else {
        const qPhone = query(usersRef, where("phone", "in", uniquePhones));
        const phoneSnap = await getDocs(qPhone);
        if (!phoneSnap.empty) {
          const docData = phoneSnap.docs[0].data();
          existingUser = {
            uid: phoneSnap.docs[0].id,
            name: docData.displayName || docData.fullName || docData.name || docData.username || 'Customer',
            ...docData
          };
        } else {
           // Fallback scan all users if still not found
           const allUsersSnap = await getDocs(usersRef);
           for (const doc of allUsersSnap.docs) {
             const u = doc.data();
             const uPhone = (u.phone || u.whatsapp || u.whatsappNumber || '').replace(/\\D/g, '');
             let cleanUPhone = uPhone;
             if (cleanUPhone.startsWith('0')) cleanUPhone = '62' + cleanUPhone.slice(1);
             if (cleanUPhone.startsWith('8')) cleanUPhone = '62' + cleanUPhone;
             if (cleanUPhone === standardPhone) {
                existingUser = { 
                  uid: doc.id, 
                  name: u.displayName || u.fullName || u.name || u.username || 'Customer',
                  ...u 
                };
                break;
             }
           }
        }
      }

      // Tentukan target user info
      let targetUserId = null;
      let finalCustomerName = \`CUST-\${standardPhone.slice(-5)} - \${trimmedRobloxUser}\`;
      let isRegisteredUser = false;

      if (existingUser && existingUser.name !== 'Customer') {
         targetUserId = existingUser.uid;
         finalCustomerName = existingUser.name;
         isRegisteredUser = true;
      } else if (existingUser) {
         targetUserId = existingUser.uid;
         finalCustomerName = existingUser.name;
         isRegisteredUser = true;
      }
      
      manualCleanPhone = standardPhone;

      // 🛡️ 1. VALIDASI AKUN ROBLOX SEDANG DIKERJAKAN
      const cleanRobloxTarget = trimmedRobloxUser.toLowerCase();
      const activeStatuses = [
        'Booking', 'Proses', 'BOOKING', 'PROSES', 
        'Menunggu Verifikasi', 'MENUNGGU VERIFIKASI',
        'PROSES_WORKER', 'PROSES WORKER', 
        'ANTRIAN_LOGIN', 'ANTRIAN', 'NEW'
      ];

      const ordersRef = collection(db, 'orders');
      const allOrdersSnap = await getDocs(ordersRef);
      const duplicateActive = allOrdersSnap.docs.find(d => {
        const ord = d.data();
        const ordUser = (ord.robloxUsername || ord.roblox_username || ord.game_username || ord.targetUsername || ord.username || '').toLowerCase().trim();
        const ordStatus = (ord.status || ord.orderStatus || '').trim();
        return ordUser === cleanRobloxTarget && activeStatuses.some(st => st.toUpperCase() === ordStatus.toUpperCase());
      });

      if (duplicateActive) {
        throw new Error("Akun Roblox ini sedang memiliki pesanan aktif yang belum selesai!");
      }

      // 💾 2. SIMPAN DOKUMEN KE FIRESTORE
      const uniqueIdNum = Math.floor(100000 + Math.random() * 900000).toString();
      const orderCustomId = \`ORD-\${uniqueIdNum}\`;
      const displayId = \`#\${uniqueIdNum}\`;
      
      const isJokoService = autoDetectedCategory === 'JOKO';
      const targetCustomerId = targetUserId || \`wa_\${manualCleanPhone}\`;
      
      const summaryString = selectedItems.length === 1 
        ? \`\${selectedItems[0].option.name} (x\${selectedItems[0].qty})\` 
        : \`Grup Paket (\${totalQty} Item: \${selectedItems.map(i => \`\${i.option.name} x\${i.qty}\`).join(', ')})\`;

      const summaryStringWithPrice = selectedItems.length === 1
        ? \`\${selectedItems[0].option.gameName || 'Roblox'} - \${selectedItems[0].option.name} (Rp \${Number(selectedItems[0].option.price).toLocaleString('id-ID')})\`
        : \`Grup Paket (\${totalQty} Item) - Rp \${totalAccumulatedPrice.toLocaleString('id-ID')}\`;

      const newOrderPayload: any = {
        id: orderCustomId,
        orderId: orderCustomId,
        orderNumber: orderCustomId,
        displayOrderId: displayId,
        idFormatted: displayId,
        
        // Identifiers Customer
        whatsapp: manualCleanPhone,
        phone: manualCleanPhone,
        customerPhone: manualCleanPhone,
        robloxUsername: trimmedRobloxUser,
        username: trimmedRobloxUser,
        targetAccount: trimmedRobloxUser,
        customerName: finalCustomerName,
        displayName: finalCustomerName,
        
        // Wajib diisi agar masuk ke profil customer
        userId: targetUserId,
        userUid: targetUserId,
        customerId: targetUserId,
        customer_id: targetUserId,
        isRegistered: isRegisteredUser,
        isManualWA: true,
        source: "manual_wa",
        
        category: isJokoService ? "joko" : "gift",
        type: isJokoService ? "joko" : "gift",
        orderType: isJokoService ? "joko" : "gift",
        service_type: isJokoService ? "joko" : "gift",
        isGift: !isJokoService,
        isJoko: isJokoService,
        gameName: selectedItems[0]?.option.gameName || "Roblox",
        packageName: summaryString,
        serviceName: \`\${selectedItems[0]?.option.gameName || 'Roblox'} - \${summaryString}\`,
        
        itemGift: !isJokoService ? summaryStringWithPrice : null,
        giftItemName: !isJokoService ? summaryString : null,
        items: selectedItems.map(i => ({
          catalogId: i.option.id,
          gameName: i.option.gameName,
          name: i.option.name,
          category: i.option.category,
          price: i.option.price,
          qty: i.qty
        })),
        
        totalPrice: totalAccumulatedPrice,
        price: totalAccumulatedPrice,
        amount: totalAccumulatedPrice,
        
        status: "BOOKING",
        orderStatus: "BOOKING",
        paymentStatus: "LUNAS",
        paymentMethod: "MANUAL_WA",
        
        isDeleted: false,
        deleted: false,
        isGuest: !isRegisteredUser,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        orderDate: serverTimestamp(),
        displayTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      };

      await setDoc(doc(db, 'orders', orderCustomId), newOrderPayload);

      // 💬 3. INISIALISASI ATAU SINKRONKAN ROOM CHAT
      const roomId = targetUserId ? \`room_\${targetUserId}\` : \`room_wa_\${manualCleanPhone}\`;
      try {
        const chatRoomRef = doc(db, 'chats', roomId);
        await setDoc(chatRoomRef, {
          id: roomId,
          order_id: roomId,
          activeOrderDocId: orderCustomId,
          latestOrder: newOrderPayload,
          orderId: orderCustomId,
          packageName: summaryString,
          customerId: targetCustomerId,
          customer_id: targetCustomerId,
          customerName: finalCustomerName,
          customer_name: finalCustomerName,
          whatsapp: manualCleanPhone,
          customerPhone: manualCleanPhone,
          robloxUsername: trimmedRobloxUser,
          lastMessage: \`🛒 Pesanan Manual WA #\${orderCustomId} (\${summaryString} - Rp \${totalAccumulatedPrice.toLocaleString('id-ID')})\`,
          last_message: \`🛒 Pesanan Manual WA #\${orderCustomId} (\${summaryString} - Rp \${totalAccumulatedPrice.toLocaleString('id-ID')})\`,
          lastMessageTime: serverTimestamp(),
          lastSender: 'admin',
          last_sender: 'admin',
          status: 'BOOKING',
          orderStatus: 'BOOKING',
          paymentStatus: 'LUNAS',
          is_read_admin: true,
          is_read_customer: false,
          updatedAt: serverTimestamp()
        }, { merge: true });

        const msgDocRef = doc(collection(db, 'chats', roomId, 'messages'));
        const nowIso = new Date().toISOString();
        await setDoc(msgDocRef, {
          id: msgDocRef.id,
          order_id: roomId,
          sender_id: 'admin_wa',
          sender_name: 'Admin WhatsApp POS',
          sender_role: 'admin',
          message: \`[PESANAN MANUAL WA]\\nNo. Order: #\${orderCustomId}\\nPaket: \${summaryString}\\nHarga: Rp \${totalAccumulatedPrice.toLocaleString('id-ID')}\\nStatus: BOOKING (LUNAS)\\nWA: +\${manualCleanPhone}\\nRoblox: \${trimmedRobloxUser}\`,
          text: \`[PESANAN MANUAL WA]\\nNo. Order: #\${orderCustomId}\\nPaket: \${summaryString}\\nHarga: Rp \${totalAccumulatedPrice.toLocaleString('id-ID')}\\nStatus: BOOKING (LUNAS)\\nWA: +\${manualCleanPhone}\\nRoblox: \${trimmedRobloxUser}\`,
          created: nowIso,
          createdAt: serverTimestamp(),
          localTimestamp: Date.now()
        });
      } catch (chatErr) {
        console.warn('Gagal update room chat otomatis:', chatErr);
      }

      setSuccessMessage(\`Orderan WA berhasil ditambahkan ke antrian Booking!\`);
      if (onOrderCreated) {
        onOrderCreated({ ...newOrderPayload, pureTime: Date.now() } as GameOrder);
      }

      setTimeout(() => {
        setPhoneInput('');
        setRobloxUsername('');
        setSuccessMessage('');
        onClose();
      }, 1000);

    } catch (err: any) {
      console.error('Error saat menyimpan order manual WA:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan pesanan manual WA.');
    } finally {
      setIsSubmitting(false);
    }
  };`;

const oldSubmitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?return \(\n    <div/m;
content = content.replace(oldSubmitRegex, newSubmitLogic + '\n\n  return (\n    <div');

fs.writeFileSync('src/components/admin/ManualWAOrderModal.tsx', content);
