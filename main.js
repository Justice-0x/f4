
function checkCode() {
  const code = document.getElementById('code').value;
  if (code === "6363" || code === "5280") {
    alert("Access Granted");
    // Redirect or reveal diagnostic content
  } else {
    alert("Access Denied. This attempt has been logged.");
  }
}
