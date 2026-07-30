function login(){

let password = document.getElementById("password").value;

let message = document.getElementById("message");


if(password === "KARA2026"){

    message.innerHTML = `
    <div class="loading">
    
    <p>ACCESS GRANTED</p>

    <p id="loadingText">
    VERIFYING IDENTITY...
    </p>

    <div class="bar">
        <div class="progress"></div>
    </div>

    </div>
    `;


    setTimeout(function(){
        document.getElementById("loadingText").innerHTML =
        "LOADING PERSONAL DATABASE...";
    },1000);


    setTimeout(function(){
        document.getElementById("loadingText").innerHTML =
        "PROFILE....... ONLINE";
    },2000);


    setTimeout(function(){
        document.getElementById("loadingText").innerHTML =
        "PHOTOS........ UNLOCKED";
    },3000);


    setTimeout(function(){
        document.getElementById("loadingText").innerHTML =
        "PROJECTS...... READY";
    },4000);


    setTimeout(function(){

        document.getElementById("loadingText").innerHTML =
        "DATABASE ACCESS COMPLETE";

    },5000);


    setTimeout(function(){

        window.location.href="archive.html";

    },6500);


}


else{

    message.innerHTML =
    "ACCESS DENIED";

}

}
