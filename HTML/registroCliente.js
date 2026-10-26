/*---
    registroCliente.js
    Registra un cliente nuevo llamando al API REST addCliente del servidor NodeJS local.
    Si el alta es exitosa vuelve a la pantalla de login.
    */

const RESTAPI = {
  addCliente: "http://localhost:8080/api/addCliente",
};

const systemURL = {
  loginCliente: "loginClient.html",
};

const formE1 = document.querySelector(".form");
const resultado1 = document.getElementById("resultado1");
const resultado2 = document.getElementById("resultado2");

/*---
    Si se llega desde el link "Registrate" del login, el correo ya escrito viene en el URL y se completa solo
    */
const params = new URLSearchParams(document.location.search);
const contactoInicial = params.get("contacto");
if (contactoInicial) {
  document.getElementById("contacto").value = contactoInicial;
}

function mostrar(elemento, texto, color) {
  elemento.style.color = color;
  elemento.style.textAlign = "center";
  elemento.style.display = "block";
  elemento.textContent = texto;
}

/*---
    Intercepta el submit del formulario
    */

formE1.addEventListener("submit", (event) => {
  event.preventDefault();
  resultado1.textContent = "";
  resultado2.textContent = "";

  const formData = new FormData(formE1);
  const data = Object.fromEntries(formData);

  /*---
        Validaciones en los datos del formulario antes de enviar al servidor
        */

  if (
    data.contacto.trim() == "" ||
    data.nombre.trim() == "" ||
    data.password == ""
  ) {
    mostrar(
      resultado1,
      "Debe informar correo electrónico, nombre y password para registrarse",
      "RED",
    );
    return;
  }

  if (data.termscondition != "on") {
    mostrar(resultado2, "Debe aceptar los T&C para poder registrarse", "RED");
    return;
  }

  const cliente = {
    contacto: data.contacto.trim(),
    nombre: data.nombre.trim(),
    password: data.password,
  };

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cliente),
  };

  /*---
        Realiza el alta en el servidor y, si resulta exitosa, vuelve al login
        */

  fetch(RESTAPI.addCliente, options)
    .then((res) => {
      return res.json();
    })
    .then((respuesta) => {
      console.log("Respuesta del servidor=" + respuesta.response);

      if (respuesta.response == "OK") {
        mostrar(resultado2, "Registro exitoso, volviendo al login...", "GREEN");
        setTimeout(() => {
          window.location.href = systemURL.loginCliente;
        }, 1500);
      } else if (respuesta.message == "Cliente ya existe") {
        mostrar(resultado1, "Ese correo ya está registrado", "RED");
      } else {
        mostrar(
          resultado1,
          "No se pudo completar el registro, intente nuevamente",
          "RED",
        );
      }
    })
    .catch(() => {
      mostrar(resultado1, "No se pudo conectar con el servidor", "RED");
    });
});
