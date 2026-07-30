function login(){

let password =
document.getElementById("password").value;


if(password === "|C~&Qi1;hV18"){

document.getElementById("message").innerHTML =
"ACCESS GRANTED...";


setTimeout(function(){

window.location.href="archive.html";

},1500);


}

else{


document.getElementById("message").innerHTML =
"ACCESS DENIED";


}

}
