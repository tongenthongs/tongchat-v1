const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminTongCoinsPanel.tsx', 'utf8');

const auditFunc = `
  const runAuditFix = async () => {
    if (!confirm('Jalankan audit & koreksi saldo untuk refund liar pada paymentStatus="DITOLAK"?')) return;
    try {
      setIsSubmitting(true);
      const ordersRef = collection(db, 'orders');
      const qOrders = query(ordersRef, /* orderBy might need index, so we fetch all or just filter client side */);
      const snap = await getDocs(qOrders);
      let countFixed = 0;
      
      for (const d of snap.docs) {
        const o = d.data();
        if (o.paymentStatus === 'DITOLAK' && o.isRefunded === true) {
          const custId = o.customer_id;
          const refundAmount = Number(o.refundAmount || o.price || 0);
          
          if (custId && refundAmount > 0) {
            // Revert customer balance
            const userRef = doc(db, 'users', custId);
            const uSnap = await getDoc(userRef);
            if (uSnap.exists()) {
              let curBal = Number(uSnap.data().tc_balance || uSnap.data().tongcoins || 0);
              curBal -= refundAmount;
              if (curBal < 0) curBal = 0;
              
              await setDoc(userRef, { tc_balance: curBal }, { merge: true });
              
              // Unmark refund
              await setDoc(doc(db, 'orders', d.id), {
                isRefunded: false,
                refundAmount: null,
                refundedAt: null
              }, { merge: true });

              countFixed++;
            }
          }
        }
      }
      alert(\`Audit selesai. Berhasil mengoreksi \${countFixed} order/user terdampak.\`);
      fetchUsers();
    } catch (err) {
      console.error('Audit error:', err);
      alert('Gagal audit: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };
`;

content = content.replace("export function AdminTongCoinsPanel", "import { getDoc } from 'firebase/firestore';\nexport function AdminTongCoinsPanel");
content = content.replace("const submitAdjustment = async", auditFunc + "\n  const submitAdjustment = async");

const buttonHtml = `
      <div className="flex justify-end mb-4">
        <button onClick={runAuditFix} disabled={isSubmitting} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow transition">
          <i className="fa-solid fa-broom mr-2"></i> Audit & Fix Refund Liar
        </button>
      </div>
`;
content = content.replace("      <div className=\"grid grid-cols-1", buttonHtml + "      <div className=\"grid grid-cols-1");

fs.writeFileSync('src/components/admin/AdminTongCoinsPanel.tsx', content);
console.log('Added audit button');
