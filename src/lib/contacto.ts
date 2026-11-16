/** Número oficial de WhatsApp de Tuval (10 dígitos). Se define al dar de alta la línea en WhatsApp Business. */
export const WHATSAPP_TUVAL = process.env.NEXT_PUBLIC_WHATSAPP_TUVAL?.replace(/\D/g, "").slice(-10) || null;

export const ligaWhatsAppTuval = (mensaje = "Hola Tuval, quiero hacer un pedido.") =>
  WHATSAPP_TUVAL ? `https://wa.me/52${WHATSAPP_TUVAL}?text=${encodeURIComponent(mensaje)}` : null;
