@extends('layouts.app')

@section('content')
    <main class="mx-auto grid max-w-5xl gap-6" data-testid="contract-page">
        <livewire:contract-lab />
        <livewire:upload-lab />
    </main>
@endsection
