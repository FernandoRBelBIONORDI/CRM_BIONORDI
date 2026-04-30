export const metadata = { title: "Política de Privacidad — BIONORDI" };

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800 font-sans">
      <h1 className="text-3xl font-bold mb-2 text-[#1E293B]">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: 30 de abril de 2025</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Quiénes somos</h2>
        <p className="leading-relaxed">
          BIONORDI es una empresa dedicada a la comercialización y servicio de equipos médicos y de ultrasonido.
          Esta política describe cómo gestionamos la información dentro de nuestro sistema CRM interno.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Información que recopilamos</h2>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed">
          <li>Nombre, teléfono, correo electrónico y datos de contacto de clientes y prospectos.</li>
          <li>Historial de comunicaciones por WhatsApp Business (mensajes entrantes y salientes).</li>
          <li>Información sobre equipos médicos, cotizaciones y órdenes de trabajo.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Cómo usamos la información</h2>
        <ul className="list-disc pl-5 space-y-2 leading-relaxed">
          <li>Gestionar la relación comercial con clientes y prospectos.</li>
          <li>Enviar comunicaciones relacionadas con cotizaciones, servicios y seguimiento de ventas.</li>
          <li>Registrar y dar seguimiento a órdenes de trabajo y servicios técnicos.</li>
          <li>Mejorar la atención al cliente mediante el historial de interacciones.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. WhatsApp Business API</h2>
        <p className="leading-relaxed">
          Utilizamos la API oficial de WhatsApp Business (Meta) para enviar y recibir mensajes con clientes.
          Los mensajes se almacenan en nuestro sistema interno únicamente para fines de seguimiento comercial.
          No compartimos el contenido de los mensajes con terceros. El uso de WhatsApp está sujeto a los
          Términos de Servicio de Meta Platforms, Inc.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Almacenamiento y seguridad</h2>
        <p className="leading-relaxed">
          La información se almacena en servidores privados con acceso restringido. Solo el personal
          autorizado de BIONORDI tiene acceso al sistema CRM. No vendemos ni compartimos datos personales
          con terceros.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Tus derechos</h2>
        <p className="leading-relaxed">
          Puedes solicitar en cualquier momento la consulta, corrección o eliminación de tus datos
          contactándonos en:
        </p>
        <p className="mt-2 font-medium">ferrosasbello@gmail.com</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Cambios a esta política</h2>
        <p className="leading-relaxed">
          Podemos actualizar esta política ocasionalmente. La fecha de última actualización siempre
          aparecerá al inicio de esta página.
        </p>
      </section>

      <p className="text-sm text-gray-400 mt-10 border-t pt-4">© 2025 BIONORDI. Todos los derechos reservados.</p>
    </div>
  );
}
