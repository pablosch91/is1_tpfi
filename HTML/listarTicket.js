/*---
Función para procesar los parámetros recibidos en el URL
*/
function getQueryParams(qs) {
  qs = qs.split("+").join(" ");

  var params = {},
    tokens,
    re = /[?&]?([^=]+)=([^&]*)/g;

  while ((tokens = re.exec(qs))) {
    params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
  }

  return params;
}

/*---
Extrae del URL el id de cliente ya validado, su nombre y la última fecha de login, actualiza banner de seguridad
*/

console.log("Comienza listarTicket.js");

var query = getQueryParams(document.location.search);
console.log("id:" + query.id);
console.log("contacto:" + query.contacto);
console.log("ultima_fecha:" + query.fecha_ultimo_ingreso);
console.log("mode:" + query.mode);

const datosCliente = [
  ["Cliente", query.nombre],
  ["Correo electrónico", query.contacto],
  ["Ultimo ingreso", query.fecha_ultimo_ingreso],
];

const tabla = document.createElement("table");
datosCliente.forEach(([etiqueta, valor]) => {
  const fila = tabla.insertRow();
  fila.insertCell().textContent = etiqueta;
  fila.insertCell().textContent = valor;
});
document.getElementById("lastlogin").replaceChildren(tabla);

const systemURL = {
  listarTicket: "listarTicket.html",
  loginCliente: "loginClient.html",
};

const RESTAPI = {
  loginCliente: "http://127.0.0.1:8080/api/loginCliente",
  listarTicket: "http://localhost:8080/api/listarTicket",
};

/*---
Define que REST API server utilizará para obtener datos, el modo lo recibe como argumento
LOCAL 
TYPICODE
AWS 

*/

const HTMLResponse = document.querySelector("#app");
var ticket = {
  ID: query.id,
};

var options = {
  method: "GET",
};
var APIREST_URL = "";
console.log("transferred mode:" + query.mode);

switch (query.mode) {
  case "LOCAL":
    console.log("Utiliza servidor NodeJS local.");
    console.log("API_listarTicket:" + RESTAPI.listarTicket);

    ticket = {
      ID: query.id,
    };

    options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ticket),
    };
    console.log(
      "ticket:" +
        JSON.stringify(ticket) +
        " options:" +
        JSON.stringify(options),
    );

    APIREST_URL = RESTAPI.listarTicket;
    break;
  case "TYPICODE":
    console.log("Typicode no soportado en ésta función");
    APIREST_URL =
      "https://my-json-server.typicode.com/lu7did/mesaayuda/posts/" + query.id;
    break;
  case "AWS": // Múltiples casos para la misma acción
    console.log("Utiliza AWS como serverless");
    APIREST_URL =
      "https://n3ttz410ze.execute-api.us-east-1.amazonaws.com/default/listTicketGET?ID=" +
      query.id;
    //clientID 803a62c8-78c8-4b63-9106-73af216d504b
    break;
  default: // Si no coincide con ninguno de los casos anteriores
    console.log("Asume AWS.");
    APIREST_URL =
      "https://n3ttz410ze.execute-api.us-east-1.amazonaws.com/default/listTicketGET?ID=" +
      query.id;
}
console.log("APIREST_URL:" + APIREST_URL);
console.log("ticket  :" + JSON.stringify(ticket));
console.log("options :" + JSON.stringify(options));

fetch(`${APIREST_URL}`, options)
  .then((res) => {
    return res.json();
  })
  .then((ticket) => {
    console.log("ticket:");
    console.log(ticket);
    let f = false;
    let table = document.createElement("table");
    table.style.border = "1px solid";
    table.style.backgroundColor = "##626607";
    //ticket.uresponse.forEach((t)=> {
    ticket.data.forEach((t) => {
      console.log(t.clienteID);
      if (t.clienteID == query.id) {
        if (f == false) {
          f = true;
          const hdr = ["Cliente", "ID", "Motivo", "Estado", "Fecha"];
          let tr = document.createElement("tr");
          tr.style.border = "1px solid";
          hdr.forEach((item) => {
            let th = document.createElement("th");
            th.style.border = "1px solid";

            th.innerText = item;
            tr.appendChild(th);
          });
          table.appendChild(tr);
        }

        const body = [
          t.clienteID,
          `${t.id}`,
          `${t.solucion}`,
          `${t.estado_solucion}`,
          `${t.ultimo_contacto}`,
        ];

        let trl = document.createElement("tr");
        body.forEach((line) => {
          let td = document.createElement("td");
          td.style.border = "1px solid";
          td.innerText = line;
          trl.appendChild(td);
        });
        table.appendChild(trl);
      }
    });

    if (f) {
      console.log(table);
      HTMLResponse.appendChild(table);
    } else {
      console.log("no tiene tickets");
      document.getElementById("mensajes").style.textAlign = "center";
      document.getElementById("mensajes").style.color = "RED";
      document.getElementById("mensajes").innerHTML =
        "No hay tickets pendientes";
    }
  });
