/*----------------------------------------------------------------------------
 *  MesaAyuda.js debe copiarse al directorio del proyecto express como index.js
 *
 *  REST API
 *  UADER - FCyT - Ingenieria de Software I
 *  Caso de estudio MesaAyuda
 *
 *  Dr. Pedro E. Colla 2023,2025
 *----------------------------------------------------------------------------*/

import express from "express"; // framework web
import crypto from "crypto"; // módulo de Node para generar IDs aleatorios
import cors from "cors"; // "intercambio de recursos entre distintos orígenes"
import AWS from "aws-sdk"; // Importa la librería oficial de Amazon (el SDK) para conectarse a Amazon AWS y pedirle cosas a la base de datos

// Las claves de AWS están en un archivo externo (una carpeta arriba) para evitar subirlas por accidente a Git y exponer la cuenta.
import accessKeyId from "../accessKeyId.js";
import secretAccessKey from "../secretAccessKey.js";

const app = express(); // crea la aplicación Express
const PORT = 8080; // y define el puerto donde va a escuchar

app.use(cors()); // Le dice al servidor que permita que otro origen/dominio/puerto pueda hacerle peticiones

// Arma la configuración (región de Virginia, endpoint de DynamoDB y credenciales) y se la aplica globalmente al SDK.
let awsConfig = {
  region: "us-east-1",
  endpoint: "https://dynamodb.us-east-1.amazonaws.com",
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
};

AWS.config.update(awsConfig);

// Crea el cliente "Document", que simplifica trabajar con DynamoDB: permite usar objetos JS normales en vez del formato interno de tipos de DynamoDB. Todas las consultas usan docClient.
let docClient = new AWS.DynamoDB.DocumentClient();

app.use(express.json()); // procesa el JSON que viene en las peticiones

// Servidor de aplicaciones Express en modo de escucha.
// Inicia el servidor HTTP en el puerto especificado (8080) para comenzar a recibir peticiones.
app.listen(PORT, () =>
  console.log(`Servidor listo en http://localhost:${PORT}`),
);

// Obtiene el valor de una propiedad de un objeto
function jsonParser(keyValue, objectValue) {
  // Verifica que el objeto exista
  if (objectValue) {
    return objectValue[keyValue];
  }
  // Si el objeto no existe, devuelve undefined
  return undefined;
}

// ---------------------- API REST Cliente ----------------------

// Endpoint GET '/api/cliente'
// Comprueba el estado de disponibilidad de la API de clientes (Health Check).
// Devuelve un código HTTP 200 con un JSON de confirmación y registra la petición en la consola.
app.get("/api/cliente", (req, res) => {
  res.status(200).send({ response: "OK", message: "API Ready" });
  console.log("API cliente: OK");
});

// Fecha de hoy como dd/mm/yyyy en horario de Argentina, sin depender de la zona horaria del servidor
function fechaHoy() {
  return new Date().toLocaleDateString("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function clienteSinPassword(cliente) {
  const { password, ...resto } = cliente;
  return resto;
}

// Endpoint POST '/api/loginCliente'
// Autentica al cliente comparando el correo electrónico (campo contacto) y la contraseña enviados en el cuerpo JSON contra la base de datos (DynamoDB).
// Comprueba que el usuario exista, que la contraseña coincida y que la cuenta esté activa.
app.post("/api/loginCliente", (req, res) => {
  const { contacto } = req.body;
  const { password } = req.body;

  console.log("loginCliente: contacto(" + contacto + ")");

  if (!password) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Password no informada" });
    return;
  }

  if (!contacto) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Correo electrónico no informado" });
    return;
  }

  const email = String(contacto).trim().toLowerCase(); // le saca espacios y pasa a minúsculas

  buscarClientePorContacto(email)
    .then(async (cliente) => {
      if (!cliente) {
        console.log("loginCliente: rechazado, cliente inexistente");
        res.status(400).send({ response: "invalido" });
        return;
      }

      if (password != cliente.password) {
        console.log("loginCliente: rechazado, password incorrecta");
        res.status(400).send({ response: "invalido" });
        return;
      }

      if (cliente.activo != true) {
        console.log("loginCliente: rechazado, cliente no activo");
        res.status(400).send({ response: "invalido" });
        return;
      }

      const ingresoAnterior = cliente.fecha_ultimo_ingreso;

      // guarda el ingreso de hoy, pero al frontend le devuelve el anterior
      await docClient
        .update({
          TableName: "cliente",
          Key: { id: cliente.id },
          UpdateExpression: "SET fecha_ultimo_ingreso = :f",
          ExpressionAttributeValues: { ":f": fechaHoy() },
        })
        .promise();

      res.status(200).send(
        JSON.stringify({
          response: "OK",
          id: cliente.id,
          nombre: cliente.nombre,
          contacto: cliente.contacto,
          fecha_ultimo_ingreso: ingresoAnterior,
        }),
      );
    })
    .catch((err) => {
      res
        .status(400)
        .send(
          JSON.stringify({
            response: "ERROR",
            message: "DB access error " + err,
          }),
        );
    });
});

// Endpoint POST '/api/existeCliente'
// Informa si ya existe un cliente con el correo indicado (campo contacto).
// Lo usa la pantalla de login para habilitar el link "Registrate" solo cuando el correo todavía no está registrado.
app.post("/api/existeCliente", (req, res) => {
  const contacto = String(req.body.contacto ?? "")
    .trim()
    .toLowerCase();

  console.log("existeCliente: contacto(" + contacto + ")");

  if (!contacto) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Correo electrónico no informado" });
    return;
  }

  buscarClientePorContacto(contacto)
    .then((cliente) => {
      res.status(200).send({ response: "OK", existe: cliente != null });
    })
    .catch((err) => {
      res.status(400).send({
        response: "ERROR",
        message: "DB access error " + err,
      });
    });
});

// Endpoint POST '/api/getCliente/:id'
// Obtiene la información de un cliente específico consultando a DynamoDB mediante el ID recibido por parámetro de URL.
// Devuelve un código HTTP 200 con el objeto del cliente si existe, o un código 400 si el cliente no se encuentra o falla la base de datos.
app.post("/api/getCliente/:id", (req, res) => {
  const { id } = req.params;

  console.log("getCliente: id(" + id + ")");

  var params = {
    TableName: "cliente",
    Key: {
      id: id,
      //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"
    },
  };

  docClient.get(params, function (err, data) {
    if (err) {
      res.status(400).send(
        JSON.stringify({
          response: "ERROR",
          message: "DB access error " + null,
        }),
      );
    } else {
      if (Object.keys(data).length != 0) {
        res
          .status(200)
          .send(
            JSON.stringify(
              { response: "OK", cliente: clienteSinPassword(data.Item) },
              null,
              2,
            ),
          );
      } else {
        res
          .status(400)
          .send(
            JSON.stringify(
              { response: "ERROR", message: "Cliente no existe" },
              null,
              2,
            ),
          );
      }
    }
  });
});

// Función para realizar un SCAN en la tabla 'cliente' buscando por el campo de contacto.
// Consulta la base de datos en DynamoDB aplicando un filtro y retorna un array con los elementos coincidentes.
async function scanDb(contacto) {
  var docClient = new AWS.DynamoDB.DocumentClient();

  const scanKey = contacto;

  const paramsScan = {
    // ScanInput
    TableName: "cliente", // required
    Select:
      "ALL_ATTRIBUTES" ||
      "ALL_PROJECTED_ATTRIBUTES" ||
      "SPECIFIC_ATTRIBUTES" ||
      "COUNT",
    FilterExpression: "contacto = :contacto",
    ExpressionAttributeValues: { ":contacto": scanKey },
  };

  var objectPromise = await docClient
    .scan(paramsScan)
    .promise()
    .then((data) => {
      return data.Items;
    });

  return objectPromise;
}

// Busca un cliente por su correo electrónico (campo "contacto").
// La tabla no tiene índice secundario sobre "contacto", por eso se usa SCAN con filtro (igual que scanDb).
// Scan lee por páginas de hasta 1 MB: se sigue leyendo hasta agotar LastEvaluatedKey.
async function buscarClientePorContacto(contacto) {
  let lastKey;
  do {
    const data = await docClient
      .scan({
        TableName: "cliente",
        FilterExpression: "contacto = :c",
        ExpressionAttributeValues: { ":c": contacto },
        ExclusiveStartKey: lastKey,
      })
      .promise();
    if (data.Items.length > 0) return data.Items[0];
    lastKey = data.LastEvaluatedKey;
  } while (lastKey);
  return null;
}

// Endpoint POST '/api/addCliente'
// Registra un nuevo cliente validando que los datos requeridos estén presentes y que el contacto no exista en DynamoDB.
// Crea el objeto del nuevo usuario con fechas de alta e ingreso iniciales y responde con un estado 200 en caso de éxito o 400 si hay errores.
app.post("/api/addCliente", (req, res) => {
  const contacto = String(req.body.contacto ?? "")
    .trim()
    .toLowerCase();
  const { password } = req.body;
  const { nombre } = req.body;

  console.log(
    "addCliente: contacto(" +
      contacto +
      ") nombre(" +
      nombre +
      ") password(" +
      password +
      ")",
  );

  if (!password) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Password no informada" });
    return;
  }

  if (!nombre) {
    res.status(400).send({ response: "ERROR", message: "Nombre no informado" });
    return;
  }

  if (!contacto) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Contacto no informado" });
    return;
  }

  scanDb(contacto).then((resultDb) => {
    if (Object.keys(resultDb).length != 0) {
      res.status(400).send({ response: "ERROR", message: "Cliente ya existe" });
      return;
    } else {
      const hoy = fechaHoy();

      const newCliente = {
        id: crypto.randomUUID(),
        contacto: contacto,
        nombre: nombre,
        password: password,
        activo: true,
        registrado: true,
        primer_ingreso: false,
        fecha_alta: hoy,
        fecha_cambio_password: hoy,
        fecha_ultimo_ingreso: hoy,
      };

      const paramsPut = {
        TableName: "cliente",
        Item: newCliente,
        ConditionExpression: "attribute_not_exists(id)",
      };

      docClient.put(paramsPut, function (err, data) {
        if (err) {
          res.status(400).send(
            JSON.stringify({
              response: "ERROR",
              message: "DB error" + err,
            }),
          );
        } else {
          res.status(200).send(
            JSON.stringify({
              response: "OK",
              cliente: clienteSinPassword(newCliente),
            }),
          );
        }
      });
    }
  });
});

// Endpoint POST '/api/updateCliente'
// Actualiza la información de un cliente (nombre, contraseña, activo y registrado) en DynamoDB previa verificación de su existencia.
// Valida los parámetros requeridos y devuelve los datos actualizados (200) o un mensaje de error (400) si faltan campos o falla la base de datos.
app.post("/api/updateCliente", (req, res) => {
  const { id } = req.body;
  const { nombre } = req.body;
  const { password } = req.body;

  var activo = (req.body.activo + "").toLowerCase() === "true";
  var registrado = (req.body.registrado + "").toLowerCase() === "true";

  console.log(
    "updateCliente: id(" +
      id +
      ") nombre(" +
      nombre +
      ") password(" +
      password +
      ") activo(" +
      activo +
      ") registrado(" +
      registrado +
      ")",
  );

  if (!id) {
    res.status(400).send({ response: "ERROR", message: "Id no informada" });
    return;
  }

  if (!nombre) {
    res.status(400).send({ response: "ERROR", message: "Nombre no informado" });
    return;
  }

  if (!password) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Password no informado" });
    return;
  }

  var params = {
    TableName: "cliente",
    Key: {
      id: id,
      //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"
    },
  };

  docClient.get(params, function (err, data) {
    if (err) {
      res.status(400).send(
        JSON.stringify({
          response: "ERROR",
          message: "DB access error " + null,
        }),
      );
      return;
    } else {
      if (Object.keys(data).length == 0) {
        res
          .status(400)
          .send(
            JSON.stringify(
              { response: "ERROR", message: "Cliente no existe" },
              null,
              2,
            ),
          );
        return;
      } else {
        const paramsUpdate = {
          ExpressionAttributeNames: {
            "#a": "activo",
            "#n": "nombre",
            "#p": "password",
            "#r": "registrado",
          },
          ExpressionAttributeValues: {
            ":a": activo,
            ":p": password,
            ":n": nombre,
            ":r": registrado,
          },
          Key: {
            id: id,
          },
          ReturnValues: "ALL_NEW",
          TableName: "cliente",
          UpdateExpression: "SET #n = :n, #p = :p, #a = :a, #r = :r",
        };

        docClient.update(paramsUpdate, function (err, data) {
          if (err) {
            res.status(400).send(
              JSON.stringify({
                response: "ERROR",
                message: "DB access error " + err,
              }),
            );
            return;
          } else {
            res.status(200).send(
              JSON.stringify({
                response: "OK",
                message: "updated",
                data: data,
              }),
            );
          }
        });
      }
    }
  });
});

// Endpoint POST '/api/resetCliente'
// Restablece la contraseña de un cliente identificado por su correo electrónico (campo contacto).
// Busca al cliente, actualiza password y fecha_cambio_password, y responde OK sin devolver datos del cliente (no expone la password).
// Valida que se envíen el correo y la nueva contraseña, devolviendo éxito (200) o un mensaje de error (400).
app.post("/api/resetCliente", (req, res) => {
  const contacto = String(req.body.contacto ?? "")
    .trim()
    .toLowerCase();
  const { password } = req.body;

  if (!contacto) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Correo electrónico no informado" });
    return;
  }

  if (!password) {
    res
      .status(400)
      .send({ response: "ERROR", message: "Password no informada" });
    return;
  }

  buscarClientePorContacto(contacto)
    .then(async (cliente) => {
      if (!cliente) {
        res
          .status(400)
          .send({ response: "ERROR", message: "Cliente no existe" });
        return;
      }

      if (password == cliente.password) {
        res
          .status(400)
          .send({ response: "ERROR", message: "Password igual a la actual" });
        return;
      }

      const hoy = fechaHoy();

      const paramsUpdate = {
        TableName: "cliente",
        Key: { id: cliente.id },
        UpdateExpression: "SET #p = :p, fecha_cambio_password = :f",
        ExpressionAttributeNames: { "#p": "password" },
        ExpressionAttributeValues: { ":p": password, ":f": hoy },
      };

      await docClient.update(paramsUpdate).promise();
      res.status(200).send({ response: "OK", message: "updated" });
    })
    .catch((err) => {
      res.status(400).send({
        response: "ERROR",
        message: "DB access error " + err,
      });
    });
});

// ---------------------- API REST Ticket ----------------------

// Función para realizar un SCAN en la tabla 'ticket' buscando por el ID del cliente.
// Consulta DynamoDB aplicando un filtro por 'clienteID' y retorna un array con todos los tickets asociados a ese cliente.
async function scanDbTicket(clienteID) {
  var docClient = new AWS.DynamoDB.DocumentClient();

  const scanKey = clienteID;

  const paramsScan = {
    // ScanInput
    TableName: "ticket", // required
    Select:
      "ALL_ATTRIBUTES" ||
      "ALL_PROJECTED_ATTRIBUTES" ||
      "SPECIFIC_ATTRIBUTES" ||
      "COUNT",
    FilterExpression: "clienteID = :clienteID",
    ExpressionAttributeValues: { ":clienteID": scanKey },
  };

  var objectPromise = await docClient
    .scan(paramsScan)
    .promise()
    .then((data) => {
      return data.Items;
    });

  return objectPromise;
}

// Endpoint POST '/api/listarTicket'
// Obtiene la lista de tickets asociados a un cliente ejecutando un SCAN en DynamoDB a través del ID recibido en el cuerpo JSON.
// Valida que el ID esté presente y responde con la lista de tickets (200) o un error si faltan datos o el cliente no tiene tickets (400).
app.post("/api/listarTicket", (req, res) => {
  const { ID } = req.body;

  console.log("listarTicket: ID(" + ID + ")");

  if (!ID) {
    res
      .status(400)
      .send({ response: "ERROR", message: "ID cliente  no informada" });
    return;
  }

  scanDbTicket(ID).then((resultDb) => {
    if (Object.keys(resultDb).length == 0) {
      res
        .status(400)
        .send({ response: "ERROR", message: "clienteID no tiene tickets" });
      return;
    } else {
      res.status(200).send(JSON.stringify({ response: "OK", data: resultDb }));
    }
  });
});

// Endpoint POST '/api/getTicket'
// Obtiene la información detallada de un ticket específico consultando a DynamoDB mediante el ID enviado en el cuerpo JSON.
// Valida la presencia del ID y devuelve un código HTTP 200 con los datos del ticket o un código 400 si el ticket no existe o falla la base de datos.
app.post("/api/getTicket", (req, res) => {
  const { id } = req.body;

  console.log("getTicket: id(" + id + ")");

  if (!id) {
    res
      .status(400)
      .send({ response: "ERROR", message: "ticket id no informada" });
    return;
  }

  var params = {
    TableName: "ticket",
    Key: {
      id: id,
      //"clienteID": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"
      //"id"       : "e08905a8-4aab-45bf-9948-4ba2b8602ced"
    },
  };

  docClient.get(params, function (err, data) {
    if (err) {
      res.status(400).send(
        JSON.stringify({
          response: "ERROR",
          message: "DB access error " + err,
        }),
      );
    } else {
      if (Object.keys(data).length == 0) {
        res.status(400).send({ response: "ERROR", message: "ticket invalido" });
      } else {
        res.status(200).send(JSON.stringify({ response: "OK", data: data }));
      }
    }
  });
});

// Endpoint POST '/api/addTicket'
// Crea un nuevo ticket asignándole un UUID como ID único, la fecha actual y un estado inicial de solución.
// Guarda el ticket en DynamoDB y responde con un código HTTP 200 y el objeto generado (o 400 en caso de error de la base de datos).
app.post("/api/addTicket", (req, res) => {
  const { clienteID } = req.body;
  const estado_solucion = 1;
  const { solucion } = req.body;
  const { descripcion } = req.body;

  const hoy = fechaHoy();

  const newTicket = {
    id: crypto.randomUUID(),
    clienteID: clienteID,
    estado_solucion: estado_solucion,
    solucion: solucion,
    descripcion: descripcion,
    fecha_apertura: hoy,
    ultimo_contacto: hoy,
  };

  const paramsPut = {
    TableName: "ticket",
    Item: newTicket,
    ConditionExpression: "attribute_not_exists(id)",
  };

  docClient.put(paramsPut, function (err, data) {
    if (err) {
      res.status(400).send(
        JSON.stringify({
          response: "ERROR",
          message: "DB error" + err,
        }),
      );
    } else {
      res
        .status(200)
        .send(JSON.stringify({ response: "OK", ticket: newTicket }));
    }
  });
});

// Endpoint POST '/api/updateTicket'
// Actualiza la información completa de un ticket en DynamoDB (clienteID, estado, solución, descripción y fecha de apertura) y actualiza automáticamente la fecha de último contacto al día de hoy.
// Valida la presencia de todos los campos obligatorios y devuelve un código 200 con el ticket actualizado o un código 400 en caso de faltar parámetros o no existir el registro.
app.post("/api/updateTicket", (req, res) => {
  const { id } = req.body;
  const { clienteID } = req.body;
  const { estado_solucion } = req.body;
  const { solucion } = req.body;
  const { descripcion } = req.body;
  const { fecha_apertura } = req.body;

  if (!id) {
    res.status(400).send({ response: "ERROR", message: "Id no informada" });
    return;
  }

  if (!clienteID) {
    res
      .status(400)
      .send({ response: "ERROR", message: "clienteID no informada" });
    return;
  }

  if (!estado_solucion) {
    res
      .status(400)
      .send({ response: "ERROR", message: "estado_solucion no informada" });
    return;
  }

  if (!solucion) {
    res
      .status(400)
      .send({ response: "ERROR", message: "solucion no informado" });
    return;
  }

  if (!fecha_apertura) {
    res.status(400).send({ response: "ERROR", message: "fecha apertura" });
    return;
  }

  const hoy = fechaHoy();

  const ultimo_contacto = hoy;

  var params = {
    TableName: "ticket",
    Key: {
      id: id,
      //test use "id": "0533a95d-7eef-4c6b-b753-1a41c9d1fbd0"
    },
  };

  docClient.get(params, function (err, data) {
    if (err) {
      res.status(400).send(
        JSON.stringify({
          response: "ERROR",
          message: "DB access error " + null,
        }),
      );
      return;
    } else {
      if (Object.keys(data).length == 0) {
        res
          .status(400)
          .send(
            JSON.stringify(
              { response: "ERROR", message: "ticket no existe" },
              null,
              2,
            ),
          );
        return;
      } else {
        const paramsUpdate = {
          ExpressionAttributeNames: {
            "#c": "clienteID",
            "#e": "estado_solucion",
            "#s": "solucion",
            "#a": "fecha_apertura",
            "#u": "ultimo_contacto",
            "#d": "descripcion",
          },
          ExpressionAttributeValues: {
            ":c": clienteID,
            ":e": estado_solucion,
            ":s": solucion,
            ":a": fecha_apertura,
            ":u": ultimo_contacto,
            ":d": descripcion,
          },
          Key: {
            id: id,
          },
          ReturnValues: "ALL_NEW",
          TableName: "ticket",
          UpdateExpression:
            "SET #c = :c, #e = :e, #a = :a, #s = :s, #d = :d, #u = :u",
        };

        docClient.update(paramsUpdate, function (err, data) {
          if (err) {
            res.status(400).send(
              JSON.stringify({
                response: "ERROR",
                message: "DB access error " + err,
              }),
            );
            return;
          } else {
            res
              .status(200)
              .send(JSON.stringify({ response: "OK", data: data }));
          }
        });
      }
    }
  });
});

// ---------------------- Partes F y G: API REST sin GUI (resumenTickets y getTicket) ----------------------

// Lee TODOS los registros de una tabla, recorriendo todas las páginas del scan (DynamoDB entrega hasta 1 MB por llamada).
async function scanTodo(tabla) {
  const items = [];
  let lastKey;
  do {
    const data = await docClient
      .scan({ TableName: tabla, ExclusiveStartKey: lastKey })
      .promise();
    items.push(...data.Items);
    lastKey = data.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// Obtiene los argumentos ID, PASSWORD y TICKET sin importar el método:
//  - POST: vienen en el cuerpo JSON.
//  - GET: vienen en la URL, tanto con el formato de la consigna (?ID=x?PASSWORD=y) como con el estándar (?ID=x&PASSWORD=y).
function leerArgumentos(req) {
  const origen = {};
  if (req.method == "POST") {
    for (const [k, v] of Object.entries(req.body ?? {})) {
      origen[k.toUpperCase()] = v;
    }
  } else {
    const qs = new URLSearchParams(
      req.originalUrl.split("?").slice(1).join("&"),
    );
    for (const [k, v] of qs) {
      origen[k.toUpperCase()] = v;
    }
  }
  return {
    usuario: origen.ID,
    password: origen.PASSWORD,
    ticket: origen.TICKET,
  };
}

// Valida usuario y password. El usuario puede ser el correo electrónico o el ID del cliente.
// Devuelve el cliente si existe, la password coincide y está activo; si no, devuelve null.
async function autenticar(usuario, password) {
  const u = String(usuario).trim();
  let cliente;
  if (u.includes("@")) {
    cliente = await buscarClientePorContacto(u.toLowerCase());
  } else {
    const data = await docClient
      .get({ TableName: "cliente", Key: { id: u } })
      .promise();
    cliente = data.Item ?? null;
  }
  if (!cliente || cliente.password != password || cliente.activo != true) {
    return null;
  }
  return cliente;
}

// Endpoint GET/POST '/resumenTickets'  (parte F)
// Con usuario y password válidos devuelve un JSON con, para cada cliente de la base: su ID, su correo,
// la cantidad de tickets y, anidados, la clave, fecha de apertura y estado de cada ticket.
async function resumenTickets(req, res) {
  try {
    const { usuario, password } = leerArgumentos(req);

    if (!usuario || !password) {
      res
        .status(400)
        .json({ response: "ERROR", message: "ID y PASSWORD son obligatorios" });
      return;
    }

    if (!(await autenticar(usuario, password))) {
      res.status(401).json({ response: "invalido" });
      return;
    }

    const [clientes, tickets] = await Promise.all([
      scanTodo("cliente"),
      scanTodo("ticket"),
    ]);

    const resumen = clientes.map((c) => {
      const propios = tickets.filter((t) => t.clienteID == c.id);
      return {
        clienteID: c.id,
        correo: c.contacto,
        cantidad_tickets: propios.length,
        tickets: propios.map((t) => ({
          id: t.id,
          fecha_apertura: t.fecha_apertura,
          estado: t.estado_solucion,
        })),
      };
    });

    res
      .status(200)
      .json({
        response: "OK",
        total_clientes: resumen.length,
        clientes: resumen,
      });
  } catch (err) {
    res
      .status(400)
      .json({ response: "ERROR", message: "DB access error " + err });
  }
}

app.get("/resumenTickets", resumenTickets);
app.post("/resumenTickets", resumenTickets);

// Endpoint GET/POST '/getTicket'  (parte G)
// Con usuario y password válidos devuelve un JSON con el ID del cliente, su correo y todos los datos del ticket indicado.
// Primero valida al cliente (si no existe o la password es inválida responde error SIN consultar el ticket).
// Un cliente solo puede consultar sus propios tickets; si el ticket no existe o no es suyo responde 404.
async function getTicketREST(req, res) {
  try {
    const { usuario, password, ticket } = leerArgumentos(req);

    if (!usuario || !password || !ticket) {
      res.status(400).json({
        response: "ERROR",
        message: "ID, PASSWORD y TICKET son obligatorios",
      });
      return;
    }

    const cliente = await autenticar(usuario, password);
    if (!cliente) {
      res.status(401).json({ response: "invalido" });
      return;
    }

    const data = await docClient
      .get({ TableName: "ticket", Key: { id: String(ticket).trim() } })
      .promise();

    if (!data.Item || data.Item.clienteID != cliente.id) {
      res.status(404).json({ response: "ERROR", message: "ticket no existe" });
      return;
    }

    res.status(200).json({
      response: "OK",
      clienteID: cliente.id,
      correo: cliente.contacto,
      ticket: data.Item,
    });
  } catch (err) {
    res
      .status(400)
      .json({ response: "ERROR", message: "DB access error " + err });
  }
}

app.get("/getTicket", getTicketREST);
app.post("/getTicket", getTicketREST);

/*---------------------- Fin del API REST ----------------------*/
