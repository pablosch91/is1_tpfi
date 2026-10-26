/*---
    Habilita el link "Registrate" solo si el correo escrito es válido y todavía no existe como cliente
    */

const RESTAPI_EXISTE = "http://localhost:8080/api/existeCliente";
const campoContacto = document.getElementById("contacto");
const linkRegistro = document.getElementById("linkRegistro");
let temporizador;

function deshabilitarRegistro(motivo) {
  linkRegistro.removeAttribute("href"); // sin href el link no se puede activar
  linkRegistro.style.color = "gray";
  linkRegistro.style.cursor = "not-allowed";
  linkRegistro.title = motivo;
}

function habilitarRegistro(contacto) {
  linkRegistro.href =
    "registroCliente.html?contacto=" + encodeURIComponent(contacto);
  linkRegistro.style.color = "";
  linkRegistro.style.cursor = "";
  linkRegistro.title = "Crear una cuenta nueva con este correo";
}

function verificarCorreo() {
  const contacto = campoContacto.value.trim().toLowerCase();

  if (contacto == "" || !campoContacto.checkValidity()) {
    /*---
    El link "¿Olvidaste tu contraseña?" lleva el correo escrito a la pantalla de cambio de password
    */
    const linkOlvido = document.getElementById("linkOlvido");
    campoContacto.addEventListener("input", () => {
      const contacto = campoContacto.value.trim();
      linkOlvido.href =
        "resetCliente.html" +
        (contacto ? "?contacto=" + encodeURIComponent(contacto) : "");
    });
    deshabilitarRegistro("Escriba un correo válido para poder registrarse");
    return;
  }

  fetch(RESTAPI_EXISTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contacto: contacto }),
  })
    .then((res) => res.json())
    .then((data) => {
      // si el usuario siguió escribiendo mientras tanto, se ignora esta respuesta
      if (campoContacto.value.trim().toLowerCase() != contacto) return;

      if (data.response == "OK" && data.existe === false) {
        habilitarRegistro(contacto);
      } else if (data.existe === true) {
        deshabilitarRegistro("Este correo ya está registrado");
      } else {
        deshabilitarRegistro("No se pudo verificar el correo");
      }
    })
    .catch(() => deshabilitarRegistro("No se pudo verificar el correo"));
}

campoContacto.addEventListener("input", () => {
  clearTimeout(temporizador);
  deshabilitarRegistro("Verificando el correo...");
  temporizador = setTimeout(verificarCorreo, 500); // espera a que termine de escribir
});

deshabilitarRegistro("Escriba un correo para poder registrarse");
if (campoContacto.value != "") verificarCorreo();

const formE1 = document.querySelector(".form");

/*---
    Intercepta el submit del formulario
    */

formE1.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(formE1);
  const data = Object.fromEntries(formData);
  console.log("Application Server: Revisa el valor del form:");
  console.log(data);

  /*---
        Realiza validaciones en los datos del formulario antes de procesar
        */

  if (data.contacto == "" || data.password == "") {
    console.log("debe indicar correo electrónico y password");
    document.getElementById("resultado1").style.color = "RED";
    document.getElementById("resultado1").style.textAlign = "center";
    document.getElementById("resultado1").textContent =
      "Debe informar correo electrónico y password para completar el acceso";
    return;
  }

  if (data.contacto == "pec") {
    /*--Fix hecho por  Germán Lombardi IS1-2025 */
    console.log("pec no es bienvenido en éste sistema");
    const m = "<li>El usuario <pec> no es bienvenido en éste sistema</li>";
    document.getElementById("resultado2").style.color = "RED";
    document.getElementById("resultado2").style.textAlign = "center";
    document.getElementById("resultado2").textContent =
      "El usuario <pec> no es bienvenido en éste sistema";
    return;
  }

  if (data.termscondition != "on") {
    console.log("no aceptó los T&C no se puede loggear");
    document.getElementById("resultado2").style.textAlign = "center";
    document.getElementById("resultado2").style.color = "RED";
    document.getElementById("resultado2").textContent =
      "Debe aceptar los T&C para poder usar el sistema";
    return;
  }

  /*---
        Genera objeto HTML a ser actualizado en el tag identificado como "app"
        */

  const HTMLResponse = document.querySelector("#app");
  const ul = document.createElement("ul");

  const tpl = document.createDocumentFragment();

  const systemURL = {
    listarTicket: "listarTicket.html",
    loginCliente: "loginClient.html",
  };

  const RESTAPI = {
    loginCliente: "http://localhost:8080/api/loginCliente",
    listarTicket: "http://localhost:8080/api/listarTicket",
  };

  /*-----
    Define el URI para realizar el acceso en base al acceso a un servidor local
*/
  const MODE =
    "LOCAL"; /*-- Instrucción a cambiar opciones LOCAL, TYPICODE o AWS --*/

  if (MODE == "LOCAL") {
    /*-----
        Crea estructuras para acceder a data del cliente
        */
    const login = {
      contacto: data.contacto.trim(),
      password: data.password,
    };

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(login),
    };

    console.log("API REST:" + RESTAPI.loginCliente);
    console.log(login);
    console.log("login(" + JSON.stringify(login) + ")");
    console.log("options " + JSON.stringify(options));
    var API = RESTAPI.loginCliente;
    var APIoptions = options;
  }

  /*----------------------------------------------------------------------*/
  /*---- Typicode utilizar id 803a62c8-78c8-4b63-9106-73af216d504b -------*/
  /*                                                                      */
  /* El siguiente código es utilizado para resolver la validación de      */
  /* cliente utilizando un "fake" API REST server en Typicode             */
  /* para realizar la validación con el REST API server correcto          */
  /* deberá cambiar la instrucción para que                               */
  /*              const tipycode=false;                                   */
  /*----------------------------------------------------------------------*/

  if (MODE == "TYPICODE") {
    console.log("Acceso usando Typicode como application server");
    API =
      "https://my-json-server.typicode.com/lu7did/MesaAyuda/posts/" + data.id;
    APIoptions = { method: "GET" };
  }

  /*----------------------------------------------------------------------*/
  /*---- AWS Accede con URL de Lambda loginUserGET                 -------*/
  /*                                                                      */
  /* cliente: 803a62c8-78c8-4b63-9106-73af216d504b                        */
  /*                                                                      */
  /* Para activar el acceso mediante AWS hacer const aws=true;            */
  /*----------------------------------------------------------------------*/
  if (MODE == "AWS") {
    console.log("Acceso usando AWS lambda como application server");
    API =
      "https://fmtj0jrpp9.execute-api.us-east-1.amazonaws.com/default/loginUserGET?ID=" +
      data.id +
      "&PASSWORD=" +
      data.password;
    APIoptions = { method: "GET" };
  }
  /*-----
    Realiza el acceso al API Rest utilizando gestión de sincronización mediante promesas
	utiliza URL y options definidos en los pasos anteriores
    */

  fetch(`${API}`, APIoptions)
    .then((res) => {
      return res.json();
    })
    .then((users) => {
      console.log(
        "Datos en respuesta del application server=" + JSON.stringify(users),
      );
      console.log("users.response=" + users.response);
      if (users.response == "OK") {
        //<==Habilitar esto para dejar que el API REST verifique sin exponer la password
        console.log("La password es correcta");
        console.log(
          "nombre(" +
            users.nombre +
            ") fecha_ultimo_ingreso(" +
            users.fecha_ultimo_ingreso +
            ")" +
            "mode(" +
            MODE +
            ")",
        );
        console.log(
          "id=" +
            users.id +
            " nombre=" +
            users.nombre +
            " ultimo=" +
            users.fecha_ultimo_ingreso,
        );
        console.log(
          "changing to " +
            systemURL.listarTicket +
            "?id=" +
            users.id +
            "&contacto=" +
            users.contacto +
            "&nombre=" +
            users.nombre +
            "&fecha_ultimo_ingreso=" +
            users.fecha_ultimo_ingreso +
            "&mode=" +
            MODE,
        );
        window.location.href =
          systemURL.listarTicket +
          "?id=" +
          users.id +
          "&contacto=" +
          users.contacto +
          "&nombre=" +
          users.nombre +
          "&fecha_ultimo_ingreso=" +
          users.fecha_ultimo_ingreso +
          "&mode=" +
          MODE;
      } else {
        console.log("La password no es correcta");
        document.getElementById("resultado1").style.color =
          "RED"; /*--Fix hecho por  Germán Lombardi IS1-2025 */
        document.getElementById("resultado1").textContent =
          "Error de login, intente nuevamente"; /*--Fix hecho por  Germán Lombardi IS1-2025 */
      }
    });
});
