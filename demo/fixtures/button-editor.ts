import './text-editor';
let clicks=0;
for(const id of ['native-button','native-link','role-button'])document.getElementById(id)!.addEventListener('click',event=>{event.preventDefault();document.getElementById('clicks')!.textContent=`Host actions: ${++clicks}`;});
