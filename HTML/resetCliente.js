/*---
    resetCliente.js
    Cambia la password de un cliente llamando al API REST resetCliente del servidor NodeJS local.
    La nueva password se pide dos veces y se verifica que ambas sean iguales antes de enviarla.
    Si el cambio es exitoso vuelve a la pantalla de login.
    */

const RESTAPI = {
  resetCliente: "http://localhost:8080/api/resetCliente",
};

const systemURL = {
  loginCliente: "loginClient.html",
};

const formE1 = document.querySelector(".form");
const resultado1 = document.getElementById("resultado1");
const resultado2 = document.getElementById("resultado2");

/*---
    Si se llega desde el link "¿Olvidaste tu contraseña?" del login, el correo ya escrito viene en el URL y se completa solo
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
    data.password == "" ||
    data.password2 == ""
  ) {
    mostrar(
      resultado1,
      "Debe informar el correo electrónico y la nueva password dos veces",
      "RED",
    );
    return;
  }

  if (data.password != data.password2) {
    mostrar(
      resultado1,
      "Las passwords no coinciden, vuelva a escribirlas",
      "RED",
    );
    return;
  }

  const cliente = {
    contacto: data.contacto.trim(),
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
        Actualiza la password en el servidor y, si resulta exitoso, vuelve al login
        */

  fetch(RESTAPI.resetCliente, options)
    .then((res) => {
      return res.json();
    })
    .then((respuesta) => {
      console.log("Respuesta del servidor=" + respuesta.response);

      if (respuesta.response == "OK") {
        mostrar(
          resultado2,
          "Password actualizada, volviendo al login...",
          "GREEN",
        );
        setTimeout(() => {
          window.location.href = systemURL.loginCliente;
        }, 1500);
      } else if (respuesta.message == "Cliente no existe") {
        mostrar(resultado1, "No existe un cliente con ese correo", "RED");
      } else if (respuesta.message == "Password igual a la actual") {
        mostrar(
          resultado1,
          "La nueva password debe ser distinta de la actual",
          "RED",
        );
      } else {
        mostrar(
          resultado1,
          "No se pudo cambiar la password, intente nuevamente",
          "RED",
        );
      }
    })
    .catch(() => {
      mostrar(resultado1, "No se pudo conectar con el servidor", "RED");
    });
});
