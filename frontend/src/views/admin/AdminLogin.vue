<script setup lang="ts">
import { reactive } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { setup, busy } = storeToRefs(auth);
const { login } = auth;
const credentials = reactive({ username: '', password: '' });

/** Выполняет вход или первичную настройку и очищает учётные данные после успеха. */
async function submit() {
  if (await login(credentials)) {
    credentials.username = '';
    credentials.password = '';
  }
}
</script>

<template>
  <section
    id="login"
    class="auth"
  >
    <h1 id="login-title">
      {{ setup ? 'Создайте администратора' : 'Вход в админку' }}
    </h1>
    <p id="login-help">
      {{
        setup
          ? 'Задайте логин и пароль (минимум 10 символов). В магазине будет один администратор.'
          : 'Введите логин и пароль администратора.'
      }}
    </p>
    <form
      id="login-form"
      @submit.prevent="submit"
    >
      <label
        >Логин
        <input
          v-model="credentials.username"
          name="username"
          autocomplete="username"
          required
          maxlength="80"
        />
      </label>
      <label
        >Пароль
        <input
          v-model="credentials.password"
          name="password"
          type="password"
          :autocomplete="setup ? 'new-password' : 'current-password'"
          required
          :minlength="setup ? 10 : 1"
          maxlength="256"
        />
      </label>
      <button
        id="login-button"
        :disabled="busy"
      >
        {{ setup ? 'Создать администратора' : 'Войти' }}
      </button>
    </form>
  </section>
</template>
