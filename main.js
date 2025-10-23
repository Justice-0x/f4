
function verifyCode() {
  const code = document.getElementById("access-code").value;
  if (code === "6363" || code === "5280") {
    alert("Access Granted");
    document.getElementById("access-container").style.display = "none";
    document.getElementById("main-content").style.display = "block";
  } else {
    alert("Access Denied. This attempt has been logged. Step away from the controls.");
  }
}

function openTab(tabName) {
  const tabs = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].style.display = "none";
  }
  document.getElementById(tabName).style.display = "block";
}
