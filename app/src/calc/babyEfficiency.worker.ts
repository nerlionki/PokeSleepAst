import { bootResourceWorker } from '../../../core/src/resources/workerBootstrap'
bootResourceWorker(() => import('./babyEfficiency.engine'))
