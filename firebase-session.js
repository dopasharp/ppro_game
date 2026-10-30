export async function signInWithRetry(auth,signIn,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
  await auth.authStateReady?.();
  if(auth.currentUser)return auth.currentUser;
  for(let attempt=0;attempt<3;attempt++){
    try{return (await signIn(auth)).user;}
    catch(error){
      if(error.code!=='auth/network-request-failed'||attempt===2)throw error;
      await sleep(600*(attempt+1));
      if(auth.currentUser)return auth.currentUser;
    }
  }
}
