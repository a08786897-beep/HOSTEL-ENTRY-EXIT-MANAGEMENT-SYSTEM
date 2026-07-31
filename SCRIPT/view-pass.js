import { inputDetails } from "./apply_for_gate_pass.js";

const StudentsDetailsPass=document.querySelector('.StudentDetails')
const SubmitButton = document.querySelector(".SubmitDetails");

SubmitButton.addEventListener("click", async () => {

    const values = await inputDetails();   // if inputDetails() is async

    const html = `
    <div class="gatePassDetails">
        <h5>Pass Details</h5>
        <hr>

        <p><b>Pass ID:</b> GP1001</p>
        <p><b>Pass Type:</b> Medical</p>
        <p><b>Destination:</b> ${values.destination}</p>
        <p><b>Date:</b> 29 July 2026</p>
        <p><b>Time:</b> 10:00 AM - 5:00 PM</p>
    </div>

    <div class="students-pass-details">
        <h5>Student Details</h5>
        <hr>

        <p><b>Name:</b> Aviral Dixit</p>
        <p><b>Roll Number:</b> AIML2025XXX</p>
        <p><b>Hostel:</b> Boys Hostel</p>
        <p><b>Room Number:</b> A-203</p>
        <p><b>Contact:</b> ${values.parentContact}</p>
    </div>
    `;

    StudentsDetailsPass.innerHTML = html;
});