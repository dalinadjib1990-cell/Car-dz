import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Automatically deletes all chats and messages associated with an ad
 * when the ad is marked as sold or deleted.
 */
export async function autoDeleteChatsForAd(adId: string) {
  if (!adId) return;
  try {
    // 1. Find all chats associated with this ad
    const chatQuery = query(collection(db, 'chats'), where('adId', '==', adId));
    const chatSnap = await getDocs(chatQuery);
    
    for (const chatDoc of chatSnap.docs) {
      const chatId = chatDoc.id;
      
      // 2. Find and delete all messages in this chat
      const msgQuery = query(collection(db, 'messages'), where('chatId', '==', chatId));
      const msgSnap = await getDocs(msgQuery);
      
      const deleteMsgPromises = msgSnap.docs.map(m => deleteDoc(doc(db, 'messages', m.id)));
      await Promise.all(deleteMsgPromises);

      // 3. Delete the chat document
      await deleteDoc(doc(db, 'chats', chatId));
    }
  } catch (error) {
    console.warn('Auto delete chats notice:', error);
  }
}

/**
 * Deletes an entire chat and all its messages.
 */
export async function deleteFullChat(chatId: string) {
  if (!chatId) return;
  try {
    const msgQuery = query(collection(db, 'messages'), where('chatId', '==', chatId));
    const msgSnap = await getDocs(msgQuery);
    const deleteMsgPromises = msgSnap.docs.map(m => deleteDoc(doc(db, 'messages', m.id)));
    await Promise.all(deleteMsgPromises);

    await deleteDoc(doc(db, 'chats', chatId));
  } catch (error) {
    console.error('Delete full chat error:', error);
    throw error;
  }
}

/**
 * Permanently deletes a single message for both seller and buyer.
 */
export async function deleteSingleMessage(messageId: string) {
  if (!messageId) return;
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    console.error('Delete message error:', error);
    throw error;
  }
}
