import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, runTransaction, onSnapshot, query, orderBy, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0jC9gSBr5vuqNJwqa9sfYghwom_PNIRM",
  authDomain: "freshers-d4106.firebaseapp.com",
  projectId: "freshers-d4106",
  storageBucket: "freshers-d4106.firebasestorage.app",
  messagingSenderId: "716567068741",
  appId: "1:716567068741:web:8676eb5c74d952fef3a32c",
  measurementId: "G-28BY3MQ4PH"
};
const app = initializeApp(firebaseConfig), db = getFirestore(app), auth = getAuth(app);

// Edit dates/venues here. Put event photos in images/ (falls back to emoji).
const EVENTS = [
  {id:"treasure", name:"Treasure Hunt", emoji:"🗺️", img:"images/treasure.jpg", date:"24 Oct 2026", time:"10:00 AM", venue:"Main Block Lawn"},
  {id:"codex",    name:"Codex",         emoji:"💻", img:"images/codex.jpg",    date:"24 Oct 2026", time:"11:30 AM", venue:"CSE Lab 2"},
  {id:"spot",     name:"Spot Games",    emoji:"🎯", img:"images/spot.jpg",     date:"24 Oct 2026", time:"01:30 PM", venue:"College Ground"},
  {id:"singing",  name:"Singing",       emoji:"🎤", img:"images/singing.jpg",  date:"24 Oct 2026", time:"03:00 PM", venue:"Auditorium"},
  {id:"dance",    name:"Dance",         emoji:"💃", img:"images/dance.jpg",    date:"24 Oct 2026", time:"04:00 PM", venue:"Auditorium"},
  {id:"ramp",     name:"Ramp Walk",     emoji:"👗", img:"images/ramp.jpg",     date:"24 Oct 2026", time:"05:00 PM", venue:"Auditorium Stage"}
];
const $ = id => document.getElementById(id);
const counts = {};
let current = null, student = JSON.parse(sessionStorage.getItem("student") || "null");
const regModal = new bootstrap.Modal($("regModal")), confModal = new bootstrap.Modal($("confModal"));

// background confetti
for (let i = 0; i < 30; i++) {
  const s = document.createElement("span");
  s.style.cssText = `left:${Math.random()*100}%;background:hsl(${Math.random()*360},90%,60%);` +
    `animation-duration:${5+Math.random()*8}s;animation-delay:${-Math.random()*10}s`;
  $("confetti").appendChild(s);
}

function renderEvents() {
  $("events").innerHTML = EVENTS.map((e, i) => `
    <div class="event-card" style="animation-delay:${i*.1}s">
      <div class="event-info">
        <h4>${e.name}</h4>
        <p class="mb-1">📅 ${e.date}</p><p class="mb-1">⏰ ${e.time}</p><p class="mb-2">📍 ${e.venue}</p>
        <p>👥 Registered: <span class="count">${counts[e.id] ?? 0}</span></p>
        <button class="btn btn-primary" data-id="${e.id}">Register</button>
      </div>
      <div class="event-img" style="background-image:url('${e.img}')"><span>${e.emoji}</span></div>
    </div>`).join("");
  document.querySelectorAll("#events button").forEach(b => b.onclick = () => openReg(b.dataset.id));
}
renderEvents();
onSnapshot(collection(db, "counters"), snap => {
  snap.forEach(d => counts[d.id] = d.data().count);
  renderEvents();
});

// student login (convenience: prefills the form)
function showLogin() {
  $("loginForm").classList.toggle("d-none", !!student);
  $("welcome").classList.toggle("d-none", !student);
  if (student) $("wName").textContent = student.name;
}
$("lgBtn").onclick = () => {
  const adm = $("lgAdm").value.trim(), name = $("lgName").value.trim();
  if (!adm || !name) return alert("Enter admission number and name");
  student = {adm, name}; sessionStorage.setItem("student", JSON.stringify(student)); showLogin();
};
$("logoutBtn").onclick = () => { student = null; sessionStorage.removeItem("student"); showLogin(); };
showLogin();

function openReg(id) {
  current = EVENTS.find(e => e.id === id);
  $("regEventName").textContent = current.name; $("regErr").textContent = "";
  if (student) { $("fAdm").value = student.adm; $("fName").value = student.name; }
  regModal.show();
}

$("regForm").onsubmit = async ev => {
  ev.preventDefault();
  const adm = $("fAdm").value.trim().toUpperCase(), name = $("fName").value.trim(),
        dept = $("fDept").value, mobile = $("fMobile").value.trim(), mail = $("fMail").value.trim();
  const err = m => $("regErr").textContent = m;
  if (!adm || !name || !dept) return err("Please fill all fields.");
  if (!/^[6-9]\d{9}$/.test(mobile)) return err("Enter a valid 10-digit mobile number.");
  if (!/^\S+@\S+\.\S+$/.test(mail)) return err("Enter a valid email address.");

  // doc id = event + admission no  => one registration per person per event
  const regRef = doc(db, "registrations", current.id + "_" + adm.replace(/[^A-Z0-9]/g, ""));
  const cntRef = doc(db, "counters", current.id);
  $("regBtn").disabled = true;
  try {
    await runTransaction(db, async tx => {
      const c = await tx.get(cntRef);
      tx.set(regRef, {eventId: current.id, eventName: current.name, adm, name, dept, mobile, mail, createdAt: serverTimestamp()});
      tx.set(cntRef, {count: (c.exists() ? c.data().count : 0) + 1});
    });
    regModal.hide(); $("regForm").reset(); showConfirm({adm, name, dept, mobile, mail});
  } catch (e) {
    err(e.code === "permission-denied" ? "This admission number is already registered for this event." : "Failed: " + e.message);
  }
  $("regBtn").disabled = false;
};

function showConfirm(s) {
  const e = current;
  $("confBody").innerHTML = `
    <h6 class="text-success">Event Details</h6>
    <p class="mb-1"><b>${e.name}</b></p><p class="mb-1">📅 ${e.date} &nbsp; ⏰ ${e.time}</p><p>📍 ${e.venue}</p><hr>
    <h6 class="text-success">Student Details</h6>
    <p class="mb-1">Admission No: <b>${s.adm}</b></p><p class="mb-1">Name: <b>${s.name}</b></p>
    <p class="mb-1">Department: <b>${s.dept}</b></p><p class="mb-1">Mobile: <b>${s.mobile}</b></p>
    <p class="mb-0">Email: <b>${s.mail}</b></p>`;
  confModal.show();
}

// ---------- Admin ----------
let unsub = null, allRegs = [];
$("adBtn").onclick = async () => {
  $("adErr").textContent = "";
  try { await signInWithEmailAndPassword(auth, $("adEmail").value, $("adPass").value); }
  catch { $("adErr").textContent = "Invalid credentials."; }
};
$("adOut").onclick = () => signOut(auth);
$("adFilter").innerHTML = `<option value="">All events</option>` + EVENTS.map(e => `<option value="${e.id}">${e.name}</option>`).join("");
$("adFilter").onchange = drawRows;
function drawRows() {
  const f = $("adFilter").value, rows = allRegs.filter(r => !f || r.eventId === f);
  $("adRows").innerHTML = rows.map((r, i) => `<tr><td>${i+1}</td><td>${r.eventName}</td><td>${r.adm}</td>
    <td>${r.name}</td><td>${r.dept}</td><td>${r.mobile}</td><td>${r.mail}</td></tr>`).join("");
}
onAuthStateChanged(auth, user => {
  $("adminLogin").classList.toggle("d-none", !!user);
  $("adminData").classList.toggle("d-none", !user);
  if (unsub) { unsub(); unsub = null; }
  if (!user) return;
  // Only succeeds if this user has a doc in /admins (see firestore.rules)
  unsub = onSnapshot(query(collection(db, "registrations"), orderBy("createdAt")),
    snap => { allRegs = snap.docs.map(d => d.data()); drawRows(); },
    () => { $("adminLogin").classList.remove("d-none"); $("adminData").classList.add("d-none");
            $("adErr").textContent = "This account is not an admin."; signOut(auth); });
});
