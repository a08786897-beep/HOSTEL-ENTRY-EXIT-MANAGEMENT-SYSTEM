// Collect gate pass form details when the form is submitted

export function inputDetails() {
    const form = document.querySelector("form");

    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const values = {
            passType: form.querySelector(".form-select")?.value || "",
            destination: form.querySelector('input[placeholder="Enter Destination"]')?.value || "",
            exitDate: form.querySelector(".Exit_Date-js")?.value || "",
            exitTime: form.querySelector(".Exit_time-js")?.value || "",
            returnDate: form.querySelector(".Return_date-js")?.value || "",
            returnTime: form.querySelector(".Return_time-js")?.value || "",
            parentContact: form.querySelector(".parent_Contact")?.value || "",
            emergencyContact: form.querySelector(".Emergency-js")?.value || "",
            completeAddress: form.querySelector(".Current_address")?.value || "",
            reason: form.querySelector(".reson_for")?.value || ""
        };

        console.log(values);


        // const data = {
        //     selector: document.querySelector(".form-select").value,
        //     distance: document.querySelector(".form-control").value,
        //     exitDate: document.querySelector(".Exit_Date-js").value,
        //     exitTime: document.querySelector(".Exit_time-js").value,
        //     returnDate: document.querySelector(".Return_date-js").value,
        //     returnTime: document.querySelector(".Return_time-js").value,
        //     parentContact: document.querySelector(".parent_Contact").value,
        //     emergencyContact: document.querySelector(".Emergency-js").value,
        //     address: document.querySelector(".Current_address").value,
        //     reason: document.querySelector(".reson_for").value
        // };

        // console.log(data);
    });
}

document.addEventListener("DOMContentLoaded", inputDetails);
