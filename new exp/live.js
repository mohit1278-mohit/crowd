let limit = 100;

/* HOME BUTTON */
function goHome() {
    window.location.href = "index.html";
}

/* ADD PHONE */
function addPhone() {
    let container = document.getElementById("phoneContainer");

    let row = document.createElement("div");
    row.className = "phone-row";

    row.innerHTML = `
        <input type="text" placeholder="Enter phone number">
        <span class="delete-btn" onclick="deletePhone(this)">🗑</span>
    `;

    container.appendChild(row);
}

/* DELETE PHONE */
function deletePhone(btn) {
    btn.parentElement.remove();
}

/* SET LIMIT */
function setLimit() {
    let input = document.getElementById("limitInput").value;

    if (input !== "") {
        limit = parseInt(input);
        document.getElementById("limitDisplay").innerText = limit;
    }
}

/* FETCH PEOPLE COUNT */
async function updatePeople() {
    try {
        let res = await fetch("http://127.0.0.1:5000/count");
        let data = await res.json();

        let people = data.people;

        document.getElementById("peopleCount").innerText = people;

        updateStatus(people);

    } catch (error) {
        console.log("Server not running");
    }
}

/* CROWD STATUS */
function updateStatus(people) {
    let statusText = document.getElementById("statusText");
    let dot = document.getElementById("bigDot");
    let smallDot = document.getElementById("smallDot");

    if (people >= limit) {
        statusText.innerText = "CROWD HIGH";
        dot.style.background = "red";
        smallDot.style.background = "red";
    }
    else if (people >= limit / 2) {
        statusText.innerText = "CROWD MEDIUM";
        dot.style.background = "orange";
        smallDot.style.background = "orange";
    }
    else {
        statusText.innerText = "CROWD SAFE";
        dot.style.background = "green";
        smallDot.style.background = "green";
    }
}

/* AUTO UPDATE */
setInterval(updatePeople, 1000);