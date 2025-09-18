import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 10,
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2d3748',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  col: {
    flex: 1,
  },
  label: {
    fontWeight: 'bold',
    marginRight: 5,
    width: 120,
  },
  value: {
    flex: 1,
  },
  vitalSigns: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 4,
    marginTop: 10,
  },
  vitalSignItem: {
    marginBottom: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#718096',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
  logo: {
    width: 120,
    marginBottom: 10,
    alignSelf: 'center',
  },
});

const MedicalRecordPDF = ({ record }) => {
  const formatDate = (dateString) => {
    return format(new Date(dateString), "d 'de' MMMM 'de' yyyy", { locale: es });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Historial Médico</Text>
          <Text style={styles.subtitle}>Clínica Veterinaria Mascota Feliz</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Mascota</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text><Text style={styles.label}>Nombre:</Text> {record.pets.name}</Text>
              <Text><Text style={styles.label}>Especie:</Text> {record.pets.species}</Text>
            </View>
            <View style={styles.col}>
              <Text><Text style={styles.label}>Dueño:</Text> {record.pets.owners.first_name} {record.pets.owners.last_name}</Text>
              <Text><Text style={styles.label}>Fecha de la consulta:</Text> {formatDate(record.visit_date)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Consulta</Text>
          <View style={styles.row}>
            <Text><Text style={styles.label}>Veterinario:</Text> {record.users.full_name}</Text>
          </View>
        </View>

        {(record.weight || record.temperature || record.heart_rate || record.respiratory_rate) && (
          <View style={[styles.section, styles.vitalSigns]}>
            <Text style={styles.sectionTitle}>Signos Vitales</Text>
            <View style={styles.row}>
              {record.weight && (
                <View style={[styles.col, styles.vitalSignItem]}>
                  <Text><Text style={styles.label}>Peso:</Text> {record.weight} kg</Text>
                </View>
              )}
              {record.temperature && (
                <View style={[styles.col, styles.vitalSignItem]}>
                  <Text><Text style={styles.label}>Temperatura:</Text> {record.temperature}°C</Text>
                </View>
              )}
            </View>
            <View style={styles.row}>
              {record.heart_rate && (
                <View style={[styles.col, styles.vitalSignItem]}>
                  <Text><Text style={styles.label}>Frecuencia Cardíaca:</Text> {record.heart_rate} bpm</Text>
                </View>
              )}
              {record.respiratory_rate && (
                <View style={[styles.col, styles.vitalSignItem]}>
                  <Text><Text style={styles.label}>Frecuencia Respiratoria:</Text> {record.respiratory_rate} rpm</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnóstico</Text>
          <Text style={{ marginBottom: 15 }}>{record.diagnosis}</Text>

          <Text style={styles.sectionTitle}>Tratamiento</Text>
          <Text style={{ marginBottom: 15 }}>{record.treatment}</Text>

          {record.notes && (
            <>
              <Text style={styles.sectionTitle}>Notas Adicionales</Text>
              <Text>{record.notes}</Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Documento generado el {format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}</Text>
          <Text>Clínica Veterinaria Mascota Feliz - Todos los derechos reservados</Text>
        </View>
      </Page>
    </Document>
  );
};

export default MedicalRecordPDF;
