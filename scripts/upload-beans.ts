const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');
const beans = require('../all_27_beans.json');

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCcy5cm_7diVnjW0EmbejXWzvwqsDr53gw",
  authDomain: "coffee-37b81.firebaseapp.com",
  projectId: "coffee-37b81",
  storageBucket: "coffee-37b81.firebasestorage.app",
  messagingSenderId: "931541737029",
  appId: "1:931541737029:web:3f24a512e5c157f837cd2c",
  measurementId: "G-FGG9QFL7M9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadBeans() {
  const beansCollection = collection(db, 'beans');
  
  for (const bean of beans) {
    try {
      // null 값 제거
      const cleanBean = Object.fromEntries(
        Object.entries(bean).filter(([_, v]) => v != null)
      );
      
      await addDoc(beansCollection, {
        ...cleanBean,
        createdAt: new Date()
      });
      console.log(`Successfully uploaded: ${bean.name}`);
    } catch (error) {
      console.error(`Error uploading ${bean.name}:`, error);
    }
  }
}

uploadBeans().then(() => {
  console.log('Upload completed!');
  process.exit(0);
}).catch((error) => {
  console.error('Upload failed:', error);
  process.exit(1);
}); 