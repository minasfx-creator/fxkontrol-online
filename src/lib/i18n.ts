/**
 * Internationalization (i18n) System
 * Supports PT-BR, EN, ES with dynamic switching.
 */

import { create } from 'zustand';

export type Locale = 'pt-BR' | 'en' | 'es';

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  'pt-BR': { label: 'Português', flag: '🇧🇷' },
  'en': { label: 'English', flag: '🇺🇸' },
  'es': { label: 'Español', flag: '🇪🇸' },
};

type TranslationKeys = {
  // Toolbar
  'toolbar.save': string;
  'toolbar.exit': string;
  'toolbar.select': string;
  'toolbar.pyro': string;
  'toolbar.drone': string;
  'toolbar.formations': string;
  'toolbar.import_csv': string;
  'toolbar.items': string;
  'toolbar.pins': string;
  'toolbar.sync_locked': string;
  'toolbar.new_project': string;
  'toolbar.open_project': string;
  'toolbar.cancel': string;
  'toolbar.create_positions': string;

  // Editor panels
  'panel.properties': string;
  'panel.effects': string;
  'panel.script': string;
  'panel.waypoints': string;
  'panel.chains': string;
  'panel.groups': string;
  'panel.swarmgpt': string;
  'panel.audio_sync': string;
  'panel.scripting': string;
  'panel.safety': string;
  'panel.summary': string;
  'panel.scene': string;
  'panel.audience': string;
  'panel.sound_level': string;
  'panel.wind_cam': string;
  'panel.particles': string;
  'panel.collisions': string;
  'panel.trajectory': string;
  'panel.templates': string;
  'panel.weather': string;
  'panel.versioning': string;
  'panel.approval': string;
  'panel.racks': string;
  'panel.addressing': string;
  'panel.inventory': string;
  'panel.labels': string;
  'panel.suppliers': string;
  'panel.firing': string;
  'panel.recorder': string;
  'panel.reports': string;
  'panel.models': string;
  'panel.background': string;
  'panel.ar_overlay': string;
  'panel.share': string;
  'panel.boids': string;
  'panel.pid': string;
  'panel.battery': string;
  'panel.mavlink': string;
  'panel.indoor': string;
  'panel.dmx': string;
  'panel.smpte': string;
  'panel.maps': string;
  'panel.diagnostic': string;
  'panel.logistics': string;
  'panel.collaborate': string;
  'panel.telemetry': string;
  'panel.flight_log': string;

  // Common
  'common.close': string;
  'common.apply': string;
  'common.reset': string;
  'common.delete': string;
  'common.duplicate': string;
  'common.export': string;
  'common.import': string;
  'common.search': string;
  'common.loading': string;
  'common.error': string;
  'common.success': string;
  'common.confirm': string;
  'common.name': string;
  'common.description': string;
  'common.type': string;
  'common.position': string;
  'common.color': string;
  'common.time': string;
  'common.duration': string;
  'common.height': string;

  // Splash
  'splash.title': string;
  'splash.subtitle': string;
  'splash.fleet_size': string;
  'splash.pyro_positions': string;
  'splash.start': string;

  // Globe
  'globe.title': string;
  'globe.search': string;

  // Timeline
  'timeline.play': string;
  'timeline.pause': string;
  'timeline.stop': string;
  'timeline.loop': string;

  // 3D Viewport
  'viewport.orbit': string;
  'viewport.pan': string;
  'viewport.zoom': string;
  'viewport.fullscreen': string;
  'viewport.satellite': string;
  'viewport.loading_3d': string;
  'viewport.performance': string;
};

const translations: Record<Locale, TranslationKeys> = {
  'pt-BR': {
    'toolbar.save': 'Salvar',
    'toolbar.exit': 'Sair',
    'toolbar.select': 'SELECIONAR',
    'toolbar.pyro': 'PYRO',
    'toolbar.drone': 'DRONE',
    'toolbar.formations': 'Formações',
    'toolbar.import_csv': 'Importar CSV',
    'toolbar.items': 'itens',
    'toolbar.pins': 'posições',
    'toolbar.sync_locked': 'Sync: Travado',
    'toolbar.new_project': 'Novo Projeto',
    'toolbar.open_project': 'Abrir Projeto',
    'toolbar.cancel': 'Cancelar',
    'toolbar.create_positions': 'Criar posições',

    'panel.properties': 'Propriedades',
    'panel.effects': 'Editor de Efeitos',
    'panel.script': 'Editor de Script',
    'panel.waypoints': 'Waypoints',
    'panel.chains': 'Cadeias',
    'panel.groups': 'Grupos',
    'panel.swarmgpt': 'SwarmGPT IA',
    'panel.audio_sync': 'Sinc. Áudio',
    'panel.scripting': 'Scripting',
    'panel.safety': 'Segurança NFPA',
    'panel.summary': 'Resumo do Show',
    'panel.scene': 'Editor de Cena',
    'panel.audience': 'Plateia',
    'panel.sound_level': 'Nível Sonoro',
    'panel.wind_cam': 'Vento/Câm',
    'panel.particles': 'Partículas',
    'panel.collisions': 'Colisões',
    'panel.trajectory': 'Otim. Trajetória',
    'panel.templates': 'Templates',
    'panel.weather': 'Clima',
    'panel.versioning': 'Versionamento',
    'panel.approval': 'Aprovação',
    'panel.racks': 'Racks',
    'panel.addressing': 'Endereçamento',
    'panel.inventory': 'Inventário',
    'panel.labels': 'Etiquetas',
    'panel.suppliers': 'Fornecedores',
    'panel.firing': 'Exportar Disparo',
    'panel.recorder': 'Gravador',
    'panel.reports': 'Relatórios',
    'panel.models': 'Modelos 3D',
    'panel.background': 'Fundo',
    'panel.ar_overlay': 'Sobreposição AR',
    'panel.share': 'Compartilhar',
    'panel.boids': 'Boids',
    'panel.pid': 'PID',
    'panel.battery': 'Bateria',
    'panel.mavlink': 'MAVLink',
    'panel.indoor': 'Sim. Indoor',
    'panel.dmx': 'DMX512',
    'panel.smpte': 'SMPTE/LTC',
    'panel.maps': 'Google Maps',
    'panel.diagnostic': 'Diagnóstico',
    'panel.logistics': 'Logística',
    'panel.collaborate': 'Colaborar',
    'panel.telemetry': 'Telemetria',
    'panel.flight_log': 'Log de Voo',

    'common.close': 'Fechar',
    'common.apply': 'Aplicar',
    'common.reset': 'Resetar',
    'common.delete': 'Excluir',
    'common.duplicate': 'Duplicar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.search': 'Buscar',
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.success': 'Sucesso',
    'common.confirm': 'Confirmar',
    'common.name': 'Nome',
    'common.description': 'Descrição',
    'common.type': 'Tipo',
    'common.position': 'Posição',
    'common.color': 'Cor',
    'common.time': 'Tempo',
    'common.duration': 'Duração',
    'common.height': 'Altura',

    'splash.title': 'Designer de Shows Pirotécnicos & Drones',
    'splash.subtitle': 'Crie shows espetaculares com fogos de artifício e drones',
    'splash.fleet_size': 'Tamanho da Frota',
    'splash.pyro_positions': 'Posições Pirotécnicas',
    'splash.start': 'Iniciar',

    'globe.title': 'Selecione o Local do Show',
    'globe.search': 'Buscar localização...',

    'timeline.play': 'Reproduzir',
    'timeline.pause': 'Pausar',
    'timeline.stop': 'Parar',
    'timeline.loop': 'Loop',

    'viewport.orbit': 'Orbitar: BEM',
    'viewport.pan': 'Pan: BMM',
    'viewport.zoom': 'Zoom: Scroll',
    'viewport.fullscreen': 'Tela Cheia',
    'viewport.satellite': 'Cenário Real',
    'viewport.loading_3d': 'Carregando Motor 3D...',
    'viewport.performance': 'Performance',
  },

  'en': {
    'toolbar.save': 'Save',
    'toolbar.exit': 'Exit',
    'toolbar.select': 'SELECT',
    'toolbar.pyro': 'PYRO',
    'toolbar.drone': 'DRONE',
    'toolbar.formations': 'Formations',
    'toolbar.import_csv': 'Import CSV',
    'toolbar.items': 'items',
    'toolbar.pins': 'pins',
    'toolbar.sync_locked': 'Sync: Locked',
    'toolbar.new_project': 'New Project',
    'toolbar.open_project': 'Open Project',
    'toolbar.cancel': 'Cancel',
    'toolbar.create_positions': 'Create positions',

    'panel.properties': 'Properties',
    'panel.effects': 'Effect Editor',
    'panel.script': 'Script Editor',
    'panel.waypoints': 'Waypoints',
    'panel.chains': 'Chains',
    'panel.groups': 'Groups',
    'panel.swarmgpt': 'SwarmGPT AI',
    'panel.audio_sync': 'Audio Sync',
    'panel.scripting': 'Scripting',
    'panel.safety': 'Safety NFPA',
    'panel.summary': 'Show Summary',
    'panel.scene': 'Scene Editor',
    'panel.audience': 'Audience',
    'panel.sound_level': 'Sound Level',
    'panel.wind_cam': 'Wind/Cam',
    'panel.particles': 'Particles',
    'panel.collisions': 'Collisions',
    'panel.trajectory': 'Trajectory Opt',
    'panel.templates': 'Templates',
    'panel.weather': 'Weather',
    'panel.versioning': 'Versioning',
    'panel.approval': 'Approval',
    'panel.racks': 'Racks',
    'panel.addressing': 'Addressing',
    'panel.inventory': 'Inventory',
    'panel.labels': 'Labels',
    'panel.suppliers': 'Suppliers',
    'panel.firing': 'Firing Export',
    'panel.recorder': 'Recorder',
    'panel.reports': 'Reports',
    'panel.models': '3D Models',
    'panel.background': 'Background',
    'panel.ar_overlay': 'AR Overlay',
    'panel.share': 'Share',
    'panel.boids': 'Boids',
    'panel.pid': 'PID',
    'panel.battery': 'Battery',
    'panel.mavlink': 'MAVLink',
    'panel.indoor': 'Indoor Sim',
    'panel.dmx': 'DMX512',
    'panel.smpte': 'SMPTE/LTC',
    'panel.maps': 'Google Maps',
    'panel.diagnostic': 'Diagnostic',
    'panel.logistics': 'Logistics',
    'panel.collaborate': 'Collaborate',
    'panel.telemetry': 'Telemetry',
    'panel.flight_log': 'Flight Log',

    'common.close': 'Close',
    'common.apply': 'Apply',
    'common.reset': 'Reset',
    'common.delete': 'Delete',
    'common.duplicate': 'Duplicate',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.name': 'Name',
    'common.description': 'Description',
    'common.type': 'Type',
    'common.position': 'Position',
    'common.color': 'Color',
    'common.time': 'Time',
    'common.duration': 'Duration',
    'common.height': 'Height',

    'splash.title': 'Pyrotechnic & Drone Show Designer',
    'splash.subtitle': 'Create spectacular shows with fireworks and drones',
    'splash.fleet_size': 'Fleet Size',
    'splash.pyro_positions': 'Pyro Positions',
    'splash.start': 'Start',

    'globe.title': 'Select Show Location',
    'globe.search': 'Search location...',

    'timeline.play': 'Play',
    'timeline.pause': 'Pause',
    'timeline.stop': 'Stop',
    'timeline.loop': 'Loop',

    'viewport.orbit': 'Orbit: LMB',
    'viewport.pan': 'Pan: MMB',
    'viewport.zoom': 'Zoom: Scroll',
    'viewport.fullscreen': 'Fullscreen',
    'viewport.satellite': 'Real Scenery',
    'viewport.loading_3d': 'Loading 3D Engine...',
    'viewport.performance': 'Performance',
  },

  'es': {
    'toolbar.save': 'Guardar',
    'toolbar.exit': 'Salir',
    'toolbar.select': 'SELECCIONAR',
    'toolbar.pyro': 'PYRO',
    'toolbar.drone': 'DRONE',
    'toolbar.formations': 'Formaciones',
    'toolbar.import_csv': 'Importar CSV',
    'toolbar.items': 'elementos',
    'toolbar.pins': 'posiciones',
    'toolbar.sync_locked': 'Sync: Bloqueado',
    'toolbar.new_project': 'Nuevo Proyecto',
    'toolbar.open_project': 'Abrir Proyecto',
    'toolbar.cancel': 'Cancelar',
    'toolbar.create_positions': 'Crear posiciones',

    'panel.properties': 'Propiedades',
    'panel.effects': 'Editor de Efectos',
    'panel.script': 'Editor de Script',
    'panel.waypoints': 'Waypoints',
    'panel.chains': 'Cadenas',
    'panel.groups': 'Grupos',
    'panel.swarmgpt': 'SwarmGPT IA',
    'panel.audio_sync': 'Sinc. Audio',
    'panel.scripting': 'Scripting',
    'panel.safety': 'Seguridad NFPA',
    'panel.summary': 'Resumen del Show',
    'panel.scene': 'Editor de Escena',
    'panel.audience': 'Audiencia',
    'panel.sound_level': 'Nivel Sonoro',
    'panel.wind_cam': 'Viento/Cám',
    'panel.particles': 'Partículas',
    'panel.collisions': 'Colisiones',
    'panel.trajectory': 'Opt. Trayectoria',
    'panel.templates': 'Plantillas',
    'panel.weather': 'Clima',
    'panel.versioning': 'Versionado',
    'panel.approval': 'Aprobación',
    'panel.racks': 'Racks',
    'panel.addressing': 'Direccionamiento',
    'panel.inventory': 'Inventario',
    'panel.labels': 'Etiquetas',
    'panel.suppliers': 'Proveedores',
    'panel.firing': 'Exportar Disparo',
    'panel.recorder': 'Grabador',
    'panel.reports': 'Informes',
    'panel.models': 'Modelos 3D',
    'panel.background': 'Fondo',
    'panel.ar_overlay': 'Superposición AR',
    'panel.share': 'Compartir',
    'panel.boids': 'Boids',
    'panel.pid': 'PID',
    'panel.battery': 'Batería',
    'panel.mavlink': 'MAVLink',
    'panel.indoor': 'Sim. Interior',
    'panel.dmx': 'DMX512',
    'panel.smpte': 'SMPTE/LTC',
    'panel.maps': 'Google Maps',
    'panel.diagnostic': 'Diagnóstico',
    'panel.logistics': 'Logística',
    'panel.collaborate': 'Colaborar',
    'panel.telemetry': 'Telemetría',
    'panel.flight_log': 'Log de Vuelo',

    'common.close': 'Cerrar',
    'common.apply': 'Aplicar',
    'common.reset': 'Restablecer',
    'common.delete': 'Eliminar',
    'common.duplicate': 'Duplicar',
    'common.export': 'Exportar',
    'common.import': 'Importar',
    'common.search': 'Buscar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.confirm': 'Confirmar',
    'common.name': 'Nombre',
    'common.description': 'Descripción',
    'common.type': 'Tipo',
    'common.position': 'Posición',
    'common.color': 'Color',
    'common.time': 'Tiempo',
    'common.duration': 'Duración',
    'common.height': 'Altura',

    'splash.title': 'Diseñador de Shows Pirotécnicos y Drones',
    'splash.subtitle': 'Crea espectáculos con fuegos artificiales y drones',
    'splash.fleet_size': 'Tamaño de Flota',
    'splash.pyro_positions': 'Posiciones Pirotécnicas',
    'splash.start': 'Iniciar',

    'globe.title': 'Seleccionar Ubicación del Show',
    'globe.search': 'Buscar ubicación...',

    'timeline.play': 'Reproducir',
    'timeline.pause': 'Pausar',
    'timeline.stop': 'Detener',
    'timeline.loop': 'Bucle',

    'viewport.orbit': 'Orbitar: BIM',
    'viewport.pan': 'Pan: BMM',
    'viewport.zoom': 'Zoom: Scroll',
    'viewport.fullscreen': 'Pantalla Completa',
    'viewport.satellite': 'Escenario Real',
    'viewport.loading_3d': 'Cargando Motor 3D...',
    'viewport.performance': 'Rendimiento',
  },
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: (localStorage.getItem('app-locale') as Locale) || 'pt-BR',
  setLocale: (locale) => {
    localStorage.setItem('app-locale', locale);
    set({ locale });
  },
}));

export function useT() {
  const locale = useI18nStore(s => s.locale);
  return (key: keyof TranslationKeys): string => {
    return translations[locale]?.[key] || translations['en'][key] || key;
  };
}

export function t(locale: Locale, key: keyof TranslationKeys): string {
  return translations[locale]?.[key] || translations['en'][key] || key;
}
