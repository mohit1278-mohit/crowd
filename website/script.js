async function getCrowdData() {

    let response = await fetch("http://127.0.0.1:5000/count");
    let data = await response.json();

    let people = data.people;

    document.getElementById("countNumber").innerText = people;

    let status = document.getElementById("statusText");

    if (people < 3) {
        status.innerText = "Safe Crowd ✅";
        status.style.color = "lightgreen";
    }
    else if (people < 8) {
        status.innerText = "Medium Crowd ⚠️";
        status.style.color = "yellow";
    }
    else {
        status.innerText = "Danger Crowd 🚨";
        status.style.color = "red";
    }
}

setInterval(getCrowdData, 1000);