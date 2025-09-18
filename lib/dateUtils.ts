// Función para formatear fechas en la zona horaria de Perú
export const formatPeruTime = (dateString: string | Date) => {
  try {
    // Crear una fecha en la zona horaria local
    let date = new Date(dateString);
    
    // Si la fecha no es válida, devolver valores por defecto
    if (isNaN(date.getTime())) {
      console.error('Fecha inválida:', dateString);
      return { date: '--/--/----', time: '--:-- --', full: '--/--/---- --:-- --' };
    }
    
    // Ajustar la hora de UTC a Perú (UTC-5)
    // 1. Obtener la hora UTC
    const utcHours = date.getUTCHours();
    
    // 2. Restar 5 horas para obtener la hora de Perú
    date.setUTCHours(utcHours - 5);
    
    // Formatear la fecha
    const datePart = date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Lima'
    });
    
    // Formatear la hora
    const timePart = date.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Lima'
    });
    
    return {
      date: datePart,
      time: timePart,
      full: `${datePart} ${timePart}`
    };
  } catch (error) {
    console.error('Error al formatear la fecha:', error, 'Fecha recibida:', dateString);
    return { date: '--/--/----', time: '--:-- --', full: '--/--/---- --:-- --' };
  }
};
