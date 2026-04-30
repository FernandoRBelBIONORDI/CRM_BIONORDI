export const metadata = { title: "Eliminación de Datos — BIONORDI" };

export default function EliminarDatosPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800 font-sans">
      <h1 className="text-3xl font-bold mb-2 text-[#1E293B]">Eliminación de Datos de Usuario</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: 30 de abril de 2025</p>

      <section className="mb-8">
        <p className="leading-relaxed mb-4">
          Si has interactuado con BIONORDI a través de WhatsApp u otros medios y deseas que eliminemos
          tu información de nuestros sistemas, puedes solicitarlo en cualquier momento.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Cómo solicitar la eliminación</h2>
        <p className="leading-relaxed mb-4">
          Envía un correo electrónico a la siguiente dirección con el asunto <strong>"Solicitud de eliminación de datos"</strong>
          e incluye tu nombre y número de teléfono para que podamos identificar tu información:
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4">
          <p className="font-semibold text-[#1E293B]">ferrosasbello@gmail.com</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Qué eliminamos</h2>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed">
          <li>Nombre, teléfono, correo y datos de contacto.</li>
          <li>Historial de mensajes de WhatsApp asociados a tu número.</li>
          <li>Cotizaciones, órdenes de trabajo y cualquier otro registro vinculado a tu perfil.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Tiempo de respuesta</h2>
        <p className="leading-relaxed">
          Procesamos las solicitudes de eliminación en un plazo máximo de <strong>15 días hábiles</strong>.
          Recibirás una confirmación por correo cuando tus datos hayan sido eliminados.
        </p>
      </section>

      <p className="text-sm text-gray-400 mt-10 border-t pt-4">© 2025 BIONORDI. Todos los derechos reservados.</p>
    </div>
  );
}
